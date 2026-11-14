-- Preuve : résultats du jury du titre professionnel (migration 20261114_jury_resultats). Qui saisit les notes saisit le jury, qui
-- lit les notes le lit ; le stagiaire ne lit rien, pas même sa ligne ; la promo d'une ligne est celle de la fiche ; la base refuse
-- un résultat mal formé.
-- Rejouable à volonté : le bloc lève TOUJOURS une exception à la fin, qui annule toutes les données de test et porte le verdict
-- (« VERT n/0 » ou « ROUGE n/k : ... »), suivi de l'empreinte md5 des règles de la table.
-- Données fictives (adresses en example.invalid, promos 9995 et 9996 à Nîmes, 9994 au centre de démonstration). Aucun compte
-- réel n'est lu.
--
-- Assemblage : outils/assembler_preuve_jury.mjs remplace la ligne « -- MIGRATION » par la migration (mode essai : VERT
-- attendu), par la migration puis son retour (mode retour : ROUGE, la table a disparu), par rien (mode en-ligne : ROUGE avant
-- application, VERT après), ou par la migration dont la règle de lecture est ouverte à tous (mode contre : ROUGE attendu sur L).
--
-- Contrôles :
--   L  lectures, par personnage, promo envoyée et aperçu : nombre de lignes vues dans la promo A / la promo B / ailleurs ;
--   W  écritures : le formateur de A ajoute, remplace (upsert), modifie et retire chez lui, jamais chez B (ni en forçant la promo
--      de la ligne) ; la direction du centre, le stagiaire, le compte sans promo et le fondateur en aperçu direction n'écrivent
--      rien ; le fondateur écrit ;
--   C  contraintes : validation partielle avec exactement un CCP, aucun CCP hors validation partielle, résultat et date bornés,
--      promo imposée par la fiche ;
--   D  structure : RLS active, deux règles par les gestes notes.lire et notes.saisir, aucun droit pour anon, aucune colonne de
--      texte libre ni d'auteur, ligne emportée par la suppression de sa fiche.

set local lock_timeout = '3s';

create or replace function pg_temp.agir(p_email text, p_promo integer, p_apercu text, p_sql text, p_lire boolean)
returns text language plpgsql as $agir$
declare n bigint; v text;
begin
  execute format('set local request.jwt.claims = %L',
    case when p_email is null then '' else json_build_object('email', p_email, 'role', 'authenticated')::text end);
  execute format('set local request.headers = %L',
    case when p_promo is null then '{}'
         when p_apercu is null then json_build_object('x-promo-id', p_promo::text)::text
         else json_build_object('x-promo-id', p_promo::text, 'x-apercu-role', p_apercu)::text end);
  if p_email is null then set local role anon; else set local role authenticated; end if;
  begin
    if p_lire then
      execute p_sql into v;
    else
      execute p_sql;
      get diagnostics n = row_count;
      v := 'OK ' || n;
    end if;
  exception when others then v := 'REFUS ' || sqlstate;
  end;
  reset role;
  return v;
end $agir$;

do $preuve$
declare
  v_pa integer := 9995;                                      -- promo A, Nîmes (lieu 1)
  v_pb integer := 9996;                                      -- promo B, Nîmes (même centre, autre équipe)
  v_pd integer := 9994;                                      -- promo du centre de démonstration
  v_ld integer;
  e_sa text := 'preuve.jury.stag.a@example.invalid';         -- stagiaire de A (a une ligne de jury)
  e_fa text := 'preuve.jury.form.a@example.invalid';         -- formateur de A
  e_fb text := 'preuve.jury.form.b@example.invalid';         -- formateur de B
  e_dn text := 'preuve.jury.direction@example.invalid';      -- direction de Nîmes (lieu 1)
  e_fo text := 'preuve.jury.fondateur@example.invalid';      -- fondateur
  e_sp text := 'preuve.jury.sans.promo@example.invalid';     -- compte connecté sans fiche ni affectation
  a1 integer; a2 integer; a3 integer; b1 integer; d1 integer;
  lire text;
  r record; v text; n bigint;
  ok integer := 0; ko text[] := '{}';
  v_regles text;
begin
  -- MIGRATION

  select md5(coalesce(string_agg(format('%s %s %s %s %s %s', policyname, permissive, cmd, roles, qual, with_check), ' | '
                                 order by policyname), '')) into v_regles
    from pg_policies where schemaname = 'public' and tablename = 'jury_resultats';
  if to_regclass('public.jury_resultats') is null then
    raise exception 'ROUGE 0/1 (règles du jury %) : la table jury_resultats est absente', v_regles;
  end if;

  -- Données fictives ------------------------------------------------------------------------------------------
  select id into v_ld from lieux where demonstration order by id limit 1;
  insert into promos (id, lieu_id, nom, date_debut) values
    (v_pa, 1, 'Preuve jury A', current_date), (v_pb, 1, 'Preuve jury B', current_date), (v_pd, v_ld, 'Preuve jury démo', current_date);
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveA1', 'Jury', 981, v_pa, true) returning id into a1;
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveA2', 'Jury', 982, v_pa, true) returning id into a2;
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveA3', 'Jury', 983, v_pa, true) returning id into a3;
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveB1', 'Jury', 984, v_pb, true) returning id into b1;
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveD1', 'Jury', 985, v_pd, true) returning id into d1;
  insert into user_profiles (email, role, stagiaire_id) values (e_sa, 'stagiaire', a1);
  insert into user_profiles (email, role, is_admin) values (e_fa, 'prof', true), (e_fb, 'prof', true), (e_dn, 'prof', false);
  insert into user_profiles (email, role, is_admin, is_founder) values (e_fo, 'prof', true, true);
  insert into user_profiles (email, role) values (e_sp, 'stagiaire');
  insert into affectations (email, role, promo_id) values (e_fa, 'formateur', v_pa), (e_fb, 'formateur', v_pb);
  insert into affectations (email, role, lieu_id) values (e_dn, 'direction', 1);
  -- Une ligne par promo (A : a1 obtenu, a2 partiel ; B : b1 ; démonstration : d1), posées en propriétaire.
  insert into jury_resultats (stagiaire_id, session_le, resultat) values (a1, '2026-12-15', 'obtenu');
  insert into jury_resultats (stagiaire_id, session_le, resultat, ccp1) values (a2, '2026-12-15', 'partiel', true);
  insert into jury_resultats (stagiaire_id, session_le, resultat) values (b1, '2026-12-15', 'non_obtenu'), (d1, '2026-12-15', 'absent');
  lire := format('select count(*) filter (where promo_id = %s) || ''/'' || count(*) filter (where promo_id = %s) || ''/'' '
    || '|| count(*) filter (where promo_id not in (%s, %s)) from public.jury_resultats', v_pa, v_pb, v_pa, v_pb);

  -- L : lectures ----------------------------------------------------------------------------------------------
  for r in select * from (values
    ('formateur de A', e_fa, v_pa, null::text, '2/0/0'),
    ('formateur de A envoie la promo B', e_fa, v_pb, null, '0/0/0'),
    ('formateur de B', e_fb, v_pb, null, '0/1/0'),
    ('direction de Nîmes sur A', e_dn, v_pa, null, '2/0/0'),
    ('direction de Nîmes sur B', e_dn, v_pb, null, '0/1/0'),
    ('direction de Nîmes envoie la promo de démonstration', e_dn, v_pd, null, '0/0/0'),
    ('stagiaire de A (sa propre ligne comprise)', e_sa, v_pa, null, '0/0/0'),
    ('stagiaire de A sans en-tête', e_sa, null, null, '0/0/0'),
    ('fondateur sur A', e_fo, v_pa, null, '2/0/0'),
    ('fondateur sur la démonstration', e_fo, v_pd, null, '0/0/1'),
    ('fondateur en aperçu formateur sur A', e_fo, v_pa, 'formateur', '2/0/0'),
    ('fondateur en aperçu direction sur A', e_fo, v_pa, 'direction', '2/0/0'),
    ('fondateur en aperçu stagiaire sur A', e_fo, v_pa, 'stagiaire', '0/0/0'),
    ('fondateur en aperçu siège sur A', e_fo, v_pa, 'siege', '0/0/0'),
    ('compte sans promo', e_sp, v_pa, null, '0/0/0')
  ) as t(nom, email, promo, apercu, attendu) loop
    v := pg_temp.agir(r.email, r.promo, r.apercu, lire, true);
    if v = r.attendu then ok := ok + 1;
    else ko := ko || format('L %s : vu %s, attendu %s', r.nom, v, r.attendu); end if;
  end loop;
  v := pg_temp.agir(null, v_pa, null, lire, true);
  if v in ('0/0/0', 'REFUS 42501') then ok := ok + 1; else ko := ko || format('L sans compte : vu %s', v); end if;

  -- W : écritures ---------------------------------------------------------------------------------------------
  for r in select * from (values
    ('formateur de A ajoute pour a3', e_fa, v_pa, null::text,
      format('insert into public.jury_resultats (stagiaire_id, session_le, resultat) values (%s, ''2026-12-16'', ''absent'')', a3), 'OK 1'),
    ('formateur de A remplace a3 (upsert)', e_fa, v_pa, null,
      format('insert into public.jury_resultats (stagiaire_id, session_le, resultat, ccp2) values (%s, ''2027-03-10'', ''partiel'', true)
              on conflict (stagiaire_id) do update set session_le = excluded.session_le, resultat = excluded.resultat,
                ccp1 = excluded.ccp1, ccp2 = excluded.ccp2, saisi_le = now()', a3), 'OK 1'),
    ('formateur de A ajoute pour une fiche de B', e_fa, v_pa, null,
      format('insert into public.jury_resultats (stagiaire_id, session_le, resultat) values (%s, ''2026-12-16'', ''obtenu'')', b1), 'REFUS 42501'),
    ('formateur de A force la promo A sur une fiche de B', e_fa, v_pa, null,
      format('insert into public.jury_resultats (stagiaire_id, promo_id, session_le, resultat) values (%s, %s, ''2026-12-16'', ''obtenu'')', b1, v_pa), 'REFUS 42501'),
    ('formateur de A modifie tout', e_fa, v_pa, null, 'update public.jury_resultats set saisi_le = saisi_le', 'OK 3'),
    ('formateur de A modifie B', e_fa, v_pa, null, format('update public.jury_resultats set resultat = ''obtenu'' where stagiaire_id = %s', b1), 'OK 0'),
    ('formateur de A supprime B', e_fa, v_pa, null, format('delete from public.jury_resultats where stagiaire_id = %s', b1), 'OK 0'),
    ('formateur de A envoie la promo B et écrit', e_fa, v_pb, null,
      format('update public.jury_resultats set resultat = ''obtenu'' where stagiaire_id = %s', b1), 'OK 0'),
    ('direction de Nîmes ajoute', e_dn, v_pa, null,
      format('insert into public.jury_resultats (stagiaire_id, session_le, resultat) values (%s, ''2026-12-16'', ''obtenu'')', a3), 'REFUS 42501'),
    ('direction de Nîmes modifie', e_dn, v_pa, null, 'update public.jury_resultats set resultat = ''obtenu''', 'OK 0'),
    ('direction de Nîmes supprime', e_dn, v_pa, null, 'delete from public.jury_resultats', 'OK 0'),
    ('stagiaire de A ajoute', e_sa, v_pa, null,
      format('insert into public.jury_resultats (stagiaire_id, session_le, resultat) values (%s, ''2026-12-16'', ''obtenu'')', a3), 'REFUS 42501'),
    ('stagiaire de A modifie sa ligne', e_sa, v_pa, null, format('update public.jury_resultats set resultat = ''obtenu'' where stagiaire_id = %s', a2), 'OK 0'),
    ('stagiaire de A supprime', e_sa, v_pa, null, 'delete from public.jury_resultats', 'OK 0'),
    ('compte sans promo modifie', e_sp, v_pa, null, 'update public.jury_resultats set resultat = ''obtenu''', 'OK 0'),
    ('fondateur en aperçu direction modifie', e_fo, v_pa, 'direction', 'update public.jury_resultats set resultat = ''obtenu''', 'OK 0'),
    ('fondateur en aperçu formateur supprime a3', e_fo, v_pa, 'formateur',
      format('delete from public.jury_resultats where stagiaire_id = %s', a3), 'OK 1'),
    ('fondateur rajoute a3', e_fo, v_pa, null,
      format('insert into public.jury_resultats (stagiaire_id, session_le, resultat) values (%s, ''2027-03-10'', ''non_obtenu'')', a3), 'OK 1'),
    ('formateur de A supprime a3', e_fa, v_pa, null, format('delete from public.jury_resultats where stagiaire_id = %s', a3), 'OK 1')
  ) as t(nom, email, promo, apercu, requete, attendu) loop
    v := pg_temp.agir(r.email, r.promo, r.apercu, r.requete, false);
    if v = r.attendu then ok := ok + 1; else ko := ko || format('W %s : %s, attendu %s', r.nom, v, r.attendu); end if;
  end loop;
  -- Ce qui reste : a1 obtenu, a2 partiel CCP1, b1 non obtenu, d1 absent ; a3 retiré ; aucune ligne touchée par un refus.
  select string_agg(s.prenom || '=' || j.resultat || case when j.ccp1 then '+1' else '' end || case when j.ccp2 then '+2' else '' end,
                    ',' order by s.prenom) into v
    from jury_resultats j join stagiaires s on s.id = j.stagiaire_id where s.nom = 'Jury';
  if v = 'PreuveA1=obtenu,PreuveA2=partiel+1,PreuveB1=non_obtenu,PreuveD1=absent' then ok := ok + 1;
  else ko := ko || format('W état final : %s', coalesce(v, 'aucune ligne')); end if;

  -- C : contraintes (en propriétaire, chacune dans sa sous-transaction) -----------------------------------------------
  for r in select * from (values
    ('validation partielle sans CCP', format('insert into jury_resultats (stagiaire_id, session_le, resultat) values (%s, ''2026-12-16'', ''partiel'')', a3), '23514'),
    ('validation partielle avec les deux CCP', format('insert into jury_resultats (stagiaire_id, session_le, resultat, ccp1, ccp2) values (%s, ''2026-12-16'', ''partiel'', true, true)', a3), '23514'),
    ('titre obtenu avec un CCP coché', format('insert into jury_resultats (stagiaire_id, session_le, resultat, ccp1) values (%s, ''2026-12-16'', ''obtenu'', true)', a3), '23514'),
    ('absent avec un CCP coché', format('insert into jury_resultats (stagiaire_id, session_le, resultat, ccp2) values (%s, ''2026-12-16'', ''absent'', true)', a3), '23514'),
    ('résultat inconnu', format('insert into jury_resultats (stagiaire_id, session_le, resultat) values (%s, ''2026-12-16'', ''admis'')', a3), '23514'),
    ('date de 2019', format('insert into jury_resultats (stagiaire_id, session_le, resultat) values (%s, ''2019-12-31'', ''obtenu'')', a3), '23514'),
    ('date sans valeur', format('insert into jury_resultats (stagiaire_id, resultat) values (%s, ''obtenu'')', a3), '23502'),
    ('seconde ligne pour la même fiche', format('insert into jury_resultats (stagiaire_id, session_le, resultat) values (%s, ''2026-12-16'', ''obtenu'')', a1), '23505'),
    ('fiche inconnue', 'insert into jury_resultats (stagiaire_id, session_le, resultat) values (-1, ''2026-12-16'', ''obtenu'')', '23502')
  ) as t(nom, requete, attendu) loop
    begin
      execute r.requete;
      v := 'accepté';
    exception when others then v := sqlstate;
    end;
    if v = r.attendu then ok := ok + 1; else ko := ko || format('C %s : %s, attendu %s', r.nom, v, r.attendu); end if;
  end loop;
  -- Promo imposée : une ligne posée avec la promo B pour une fiche de A reste dans A.
  insert into jury_resultats (stagiaire_id, promo_id, session_le, resultat) values (a3, v_pb, '2026-12-16', 'obtenu');
  select promo_id into n from jury_resultats where stagiaire_id = a3;
  if n = v_pa then ok := ok + 1; else ko := ko || format('C promo imposée : %s, attendu %s', n, v_pa); end if;
  -- Une fiche qui change de promo emporte sa ligne à la première écriture (comme les notes).
  update stagiaires set promo_id = v_pb where id = a3;
  update jury_resultats set saisi_le = saisi_le where stagiaire_id = a3;
  select promo_id into n from jury_resultats where stagiaire_id = a3;
  if n = v_pb then ok := ok + 1; else ko := ko || format('C promo suivie après changement de promo : %s, attendu %s', n, v_pb); end if;

  -- D : structure ---------------------------------------------------------------------------------------------
  if (select relrowsecurity from pg_class where oid = 'public.jury_resultats'::regclass) then ok := ok + 1;
  else ko := ko || 'D RLS inactive'::text; end if;
  select string_agg(policyname || ':' || cmd, ',' order by policyname) into v
    from pg_policies where schemaname = 'public' and tablename = 'jury_resultats';
  if v = 'jury_resultats_ecriture:ALL,jury_resultats_lecture:SELECT' then ok := ok + 1;
  else ko := ko || format('D règles : %s', coalesce(v, 'aucune')); end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'jury_resultats'
              and policyname = 'jury_resultats_lecture' and qual like '%geste_promo%notes.lire%')
     and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'jury_resultats'
              and policyname = 'jury_resultats_ecriture' and qual like '%geste_promo%notes.saisir%' and with_check like '%geste_promo%notes.saisir%')
  then ok := ok + 1; else ko := ko || 'D les règles ne passent pas par notes.lire et notes.saisir'::text; end if;
  if not (has_table_privilege('anon', 'public.jury_resultats', 'select') or has_table_privilege('anon', 'public.jury_resultats', 'insert')
          or has_table_privilege('anon', 'public.jury_resultats', 'update') or has_table_privilege('anon', 'public.jury_resultats', 'delete'))
  then ok := ok + 1; else ko := ko || 'D anon a un droit sur la table'::text; end if;
  select string_agg(column_name || ':' || data_type, ',' order by ordinal_position) into v
    from information_schema.columns where table_schema = 'public' and table_name = 'jury_resultats';
  if v = 'stagiaire_id:integer,promo_id:integer,session_le:date,resultat:text,ccp1:boolean,ccp2:boolean,saisi_le:timestamp with time zone'
  then ok := ok + 1; else ko := ko || format('D colonnes inattendues (texte libre ou auteur ?) : %s', v); end if;
  delete from stagiaires where id = a1;
  if not exists (select 1 from jury_resultats where stagiaire_id = a1) then ok := ok + 1;
  else ko := ko || 'D la ligne survit à la suppression de sa fiche'::text; end if;

  -- Verdict ---------------------------------------------------------------------------------------------------
  if cardinality(ko) = 0 then
    raise exception 'VERT %/0 (règles du jury %)', ok, v_regles;
  else
    raise exception 'ROUGE %/% (règles du jury %) : %', ok, cardinality(ko), v_regles, array_to_string(ko, ' | ');
  end if;
end $preuve$;
