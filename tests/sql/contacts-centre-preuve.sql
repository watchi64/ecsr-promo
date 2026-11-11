-- Preuve : chaque contact appartient à un centre, et chacun ne lit ou n'écrit que les contacts du centre de la promo
-- affichée (migration 20261113_contacts_centre) ; Montpellier a reçu la copie des contacts de Nîmes (même secrétariat,
-- migration 20261113_contacts_centre_2_montpellier).
-- Rejouable à volonté : le bloc lève TOUJOURS une exception à la fin, qui annule toutes les données de test et porte le
-- verdict (« VERT n/0 » ou « ROUGE n/k : ... »), suivi de l'empreinte md5 des règles de la table contacts.
-- Données fictives (adresses en example.invalid, promos 9997 à Nîmes et 9998 au centre de démonstration). Les comptes
-- réels ne sont lus qu'en comptes : aucun nom, numéro ni adresse réels n'est écrit ici ni rendu par le verdict.
--
-- Assemblage : outils/assembler_preuve_contacts.mjs remplace la ligne « -- MIGRATION » par la migration (mode essai :
-- VERT attendu), ou par la migration puis son retour (mode retour : ROUGE attendu, la colonne a disparu, et l'empreinte
-- d'avant). Contre la base d'avant la migration (mode en-ligne avant application), tout est ROUGE : c'est la fuite.
-- Après application, le mode en-ligne est VERT, à l'empreinte de l'essai. Contre-épreuve : le mode sans-regle injecte la
-- migration privée de sa règle restrictive (colonne et données présentes) : ROUGE attendu sur L, W et D.
--
-- Contrôles :
--   L  lectures, par personnage et promo envoyée : nombre de contacts vus à Nîmes / au centre de démonstration / ailleurs ;
--      le stagiaire de la démonstration ne voit aucun contact de Nîmes, celui de Nîmes voit tous les siens ;
--   W  écritures : l'équipe d'un centre ajoute chez elle (le centre est posé d'office), jamais chez l'autre, ni en
--      envoyant la promo de l'autre ; elle ne modifie ni ne supprime une ligne de l'autre et ne peut pas y déplacer la
--      sienne ; un stagiaire n'écrit rien ;
--   D  données : colonne obligatoire ; les contacts d'avant sont à Nîmes ou en sont la copie à Montpellier, qui a exactement
--      les contacts de Nîmes ; deux contacts fictifs (demo.test, 01 99 00)
--      par centre de démonstration, aucun ailleurs ; la règle restrictive est en place ;
--   R  comptes réels : chaque stagiaire (promo de sa fiche), chaque formateur (sa promo), chaque direction (les promos de son
--      centre) et le fondateur (toutes les promos) voient exactement les contacts du centre de la promo affichée.

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
  v_pn integer := 9997;                                         -- promo fictive de Nîmes (lieu 1)
  v_pd integer := 9998;                                         -- promo fictive du centre de démonstration
  v_ln integer := 1;
  v_ld integer;
  e_sn text := 'preuve.contacts.s.nimes@example.invalid';       -- stagiaire de 9997
  e_sd text := 'preuve.contacts.s.demo@example.invalid';        -- stagiaire de 9998
  e_fn text := 'preuve.contacts.formateur@example.invalid';     -- formateur de 9997
  e_dd text := 'preuve.contacts.direction@example.invalid';     -- direction du centre de démonstration
  e_fo text := 'preuve.contacts.fondateur@example.invalid';     -- fondateur
  e_sp text := 'preuve.contacts.sans.promo@example.invalid';    -- compte connecté sans fiche ni affectation
  v_lm integer;                                                 -- un autre centre réel (Montpellier), s'il existe
  lire text;
  v_l integer;
  v_avant bigint[];
  n_n bigint; n_d bigint;
  sn integer; sd integer;
  r record; v text; attendu text; n bigint;
  ok integer := 0; ko text[] := '{}';
  n_reel integer := 0; n_reel_ko integer := 0;
  v_regles text;
begin
  -- Les contacts d'avant (hors fictifs de démonstration), pour D.
  select coalesce(array_agg(id order by id), '{}') into v_avant from contacts where coalesce(email, '') not like '%@demo.test';

  -- MIGRATION

  -- Sans la colonne (avant la migration, ou après son retour), rien ne se juge : ROUGE tout de suite.
  select md5(coalesce(string_agg(format('%s %s %s %s %s %s', policyname, permissive, cmd, roles, qual, with_check), ' | '
                                 order by policyname), '')) into v_regles
    from pg_policies where schemaname = 'public' and tablename = 'contacts';
  if not exists (select 1 from pg_attribute where attrelid = 'public.contacts'::regclass and attname = 'lieu_id' and not attisdropped) then
    raise exception 'ROUGE 0/1 (règles de contacts %) : la colonne contacts.lieu_id est absente, chaque compte voit tous les contacts', v_regles;
  end if;

  -- Données fictives ------------------------------------------------------------------------------------------
  select id into v_ld from lieux where demonstration order by id limit 1;
  -- Les centres en littéraux : un compte connecté ne lit pas forcément la table des lieux.
  lire := format('select count(*) filter (where lieu_id = 1) || ''/'' || count(*) filter (where lieu_id = %s) || ''/'' '
    || '|| count(*) filter (where lieu_id not in (1, %s)) from public.contacts', v_ld, v_ld);
  insert into promos (id, lieu_id, nom, date_debut) values
    (v_pn, v_ln, 'Preuve contacts Nîmes', current_date), (v_pd, v_ld, 'Preuve contacts démo', current_date);
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveSN', 'Contacts', 991, v_pn, true) returning id into sn;
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveSD', 'Contacts', 992, v_pd, true) returning id into sd;
  insert into user_profiles (email, role, stagiaire_id) values (e_sn, 'stagiaire', sn), (e_sd, 'stagiaire', sd);
  insert into user_profiles (email, role, is_admin) values (e_fn, 'prof', true), (e_dd, 'prof', false);
  insert into user_profiles (email, role, is_admin, is_founder) values (e_fo, 'prof', true, true);
  insert into user_profiles (email, role) values (e_sp, 'stagiaire');
  -- Un contact fictif dans un troisième centre : la troisième colonne des lectures (« ailleurs ») doit rester à 0.
  select id into v_lm from lieux where id <> 1 and not demonstration order by id limit 1;
  if v_lm is not null then
    insert into contacts (prenom, lieu_id) values ('PreuveAutreCentre', v_lm);
  end if;
  insert into affectations (email, role, promo_id) values (e_fn, 'formateur', v_pn);
  insert into affectations (email, role, lieu_id) values (e_dd, 'direction', v_ld);
  execute 'select count(*) from contacts where lieu_id = 1' into n_n;
  execute 'select count(*) from contacts where lieu_id = $1' into n_d using v_ld;

  -- L : lectures ----------------------------------------------------------------------------------------------
  for r in select * from (values
    ('stagiaire de Nîmes', e_sn, v_pn, null::text, format('%s/0/0', n_n)),
    ('stagiaire de la démonstration', e_sd, v_pd, null, format('0/%s/0', n_d)),
    ('stagiaire de la démonstration envoie la promo de Nîmes', e_sd, v_pn, null, '0/0/0'),
    ('formateur de Nîmes', e_fn, v_pn, null, format('%s/0/0', n_n)),
    ('formateur de Nîmes envoie la promo de démonstration', e_fn, v_pd, null, '0/0/0'),
    ('direction de la démonstration', e_dd, v_pd, null, format('0/%s/0', n_d)),
    ('direction de la démonstration envoie la promo de Nîmes', e_dd, v_pn, null, '0/0/0'),
    ('fondateur sur Nîmes', e_fo, v_pn, null, format('%s/0/0', n_n)),
    ('fondateur sur la démonstration', e_fo, v_pd, null, format('0/%s/0', n_d)),
    ('fondateur en aperçu stagiaire de la démonstration', e_fo, v_pd, 'stagiaire', format('0/%s/0', n_d)),
    ('fondateur en aperçu siège', e_fo, v_pd, 'siege', '0/0/0'),
    ('compte sans promo', e_sp, v_pn, null, '0/0/0'),
    ('stagiaire de Nîmes sans en-tête (promo par défaut)', e_sn, null, null, format('%s/0/0', n_n))
  ) as t(nom, email, promo, apercu, attendu) loop
    v := pg_temp.agir(r.email, r.promo, r.apercu, lire, true);
    if v = r.attendu then ok := ok + 1;
    else ko := ko || format('L %s : vu %s, attendu %s', r.nom, v, r.attendu); end if;
  end loop;
  -- Sans compte : rien (refus ou zéro).
  v := pg_temp.agir(null, null, null, lire, true);
  if v in ('0/0/0', 'REFUS 42501') then ok := ok + 1; else ko := ko || format('L sans compte : vu %s', v); end if;
  -- Les deux centres ont bien des contacts (sinon L ne prouverait rien).
  if n_n > 0 and n_d = 2 and v_lm is not null then ok := ok + 1;
  else ko := ko || format('L données : %s contacts à Nîmes, %s au centre de démonstration, autre centre %s (attendu > 0, 2 et présent)',
                          n_n, n_d, coalesce(v_lm::text, 'absent')); end if;

  -- W : écritures ---------------------------------------------------------------------------------------------
  for r in select * from (values
    ('formateur de Nîmes ajoute chez lui', e_fn, v_pn,
      'insert into public.contacts (prenom, note) values (''PreuveContactN'', ''preuve'')', 'OK 1'),
    ('formateur de Nîmes ajoute au centre de démonstration', e_fn, v_pn,
      format('insert into public.contacts (prenom, lieu_id) values (''PreuveContactX'', %s)', v_ld), 'REFUS 42501'),
    ('formateur de Nîmes modifie la démonstration', e_fn, v_pn,
      format('update public.contacts set note = ''PreuveMaj'' where lieu_id = %s', v_ld), 'OK 0'),
    ('formateur de Nîmes supprime la démonstration', e_fn, v_pn,
      format('delete from public.contacts where lieu_id = %s', v_ld), 'OK 0'),
    ('formateur de Nîmes déplace son contact', e_fn, v_pn,
      format('update public.contacts set lieu_id = %s where prenom = ''PreuveContactN''', v_ld), 'REFUS 42501'),
    ('formateur de Nîmes modifie tout', e_fn, v_pn,
      'update public.contacts set note = note', format('OK %s', n_n + 1)),
    ('formateur de Nîmes ajoute chez lui, centre explicite', e_fn, v_pn,
      'insert into public.contacts (prenom, lieu_id) values (''PreuveExplicite'', 1)', 'OK 1'),
    ('formateur de Nîmes supprime chez lui', e_fn, v_pn,
      'delete from public.contacts where prenom = ''PreuveExplicite''', 'OK 1'),
    ('formateur de Nîmes modifie l''autre centre', e_fn, v_pn,
      'update public.contacts set note = ''PreuveMaj'' where prenom = ''PreuveAutreCentre''', 'OK 0'),
    ('formateur de Nîmes envoie la promo de démonstration', e_fn, v_pd,
      format('insert into public.contacts (prenom, lieu_id) values (''PreuveContactX'', %s)', v_ld), 'REFUS 42501'),
    ('direction de la démonstration ajoute chez elle', e_dd, v_pd,
      'insert into public.contacts (prenom, note) values (''PreuveContactD'', ''preuve'')', 'OK 1'),
    ('direction de la démonstration ajoute à Nîmes', e_dd, v_pd,
      'insert into public.contacts (prenom, lieu_id) values (''PreuveContactX'', 1)', 'REFUS 42501'),
    ('direction de la démonstration modifie Nîmes', e_dd, v_pd,
      'update public.contacts set note = ''PreuveMaj'' where lieu_id = 1', 'OK 0'),
    ('direction de la démonstration supprime Nîmes', e_dd, v_pd,
      'delete from public.contacts where lieu_id = 1', 'OK 0'),
    ('stagiaire de Nîmes ajoute', e_sn, v_pn,
      'insert into public.contacts (prenom) values (''PreuveContactX'')', 'REFUS 42501'),
    ('stagiaire de Nîmes modifie', e_sn, v_pn, 'update public.contacts set note = ''PreuveMaj''', 'OK 0'),
    ('stagiaire de Nîmes supprime', e_sn, v_pn, 'delete from public.contacts', 'OK 0'),
    ('fondateur ajoute sur la démonstration', e_fo, v_pd,
      'insert into public.contacts (prenom, note) values (''PreuveContactF'', ''preuve'')', 'OK 1')
  ) as t(nom, email, promo, requete, attendu) loop
    v := pg_temp.agir(r.email, r.promo, null, r.requete, false);
    if v = r.attendu then ok := ok + 1; else ko := ko || format('W %s : %s, attendu %s', r.nom, v, r.attendu); end if;
  end loop;
  -- Le centre posé d'office est celui de la promo affichée.
  execute 'select string_agg(prenom || ''='' || (case when lieu_id = 1 then ''N'' when lieu_id = $1 then ''D'' else lieu_id::text end), '','' order by prenom)
             from contacts where prenom like ''PreuveContact%''' into v using v_ld;
  if v = 'PreuveContactD=D,PreuveContactF=D,PreuveContactN=N' then ok := ok + 1;
  else ko := ko || format('W centre posé d''office : %s', coalesce(v, 'aucun')); end if;
  if not exists (select 1 from contacts where prenom = 'PreuveExplicite') then ok := ok + 1;
  else ko := ko || 'W la suppression dans son centre n''a rien supprimé'::text; end if;
  if not exists (select 1 from contacts where note = 'PreuveMaj') then ok := ok + 1;
  else ko := ko || 'W une modification d''un autre centre a été écrite'::text; end if;

  -- D : données -----------------------------------------------------------------------------------------------
  if exists (select 1 from pg_attribute where attrelid = 'public.contacts'::regclass and attname = 'lieu_id' and attnotnull)
  then ok := ok + 1; else ko := ko || 'D colonne lieu_id absente ou facultative'::text; end if;
  execute 'select count(*) from contacts c where c.id = any($1) and c.lieu_id is distinct from 1
             and not (c.lieu_id = 2 and exists (select 1 from contacts n where n.lieu_id = 1 and n.prenom = c.prenom
                                                 and n.phone is not distinct from c.phone))' into n using v_avant;
  if n = 0 and cardinality(v_avant) > 0 then ok := ok + 1;
  else ko := ko || format('D contacts d''avant hors de Nîmes (ni copie à Montpellier) : %s sur %s', n, cardinality(v_avant)); end if;
  -- Montpellier (lieu 2) a exactement les contacts de Nîmes, hors lignes fictives de cette preuve.
  execute 'select count(*) from (
             (select prenom, role, phone, email, note, category, sort_order from contacts where lieu_id = 1 and prenom not like ''Preuve%''
              except all
              select prenom, role, phone, email, note, category, sort_order from contacts where lieu_id = 2 and prenom not like ''Preuve%'')
             union all
             (select prenom, role, phone, email, note, category, sort_order from contacts where lieu_id = 2 and prenom not like ''Preuve%''
              except all
              select prenom, role, phone, email, note, category, sort_order from contacts where lieu_id = 1 and prenom not like ''Preuve%'')) e' into n;
  if n = 0 and exists (select 1 from contacts where lieu_id = 2 and prenom not like 'Preuve%') then ok := ok + 1;
  else ko := ko || format('D Montpellier n''a pas exactement les contacts de Nîmes : %s écarts', n); end if;
  execute 'select count(*) from lieux l where l.demonstration and (select count(*) from contacts c where c.lieu_id = l.id
             and c.email like ''%@demo.test'' and c.phone like ''01 99 00 %'') <> 2' into n;
  if n = 0 and exists (select 1 from lieux where demonstration) then ok := ok + 1;
  else ko := ko || format('D %s centres de démonstration sans leurs deux contacts fictifs', n); end if;
  execute 'select count(*) from contacts c join lieux l on l.id = c.lieu_id where not l.demonstration and c.email like ''%@demo.test''' into n;
  if n = 0 then ok := ok + 1; else ko := ko || format('D %s contacts fictifs hors démonstration', n); end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contacts'
              and policyname = 'contacts_meme_centre' and permissive = 'RESTRICTIVE' and cmd = 'ALL')
  then ok := ok + 1; else ko := ko || 'D règle restrictive contacts_meme_centre absente'::text; end if;

  -- R : comptes réels (hors fictifs de cette preuve), en comptes seulement -------------------------------------
  for r in select u.email, s.promo_id as promo from user_profiles u join stagiaires s on s.id = u.stagiaire_id
            where u.email not like '%@example.invalid' and not u.is_founder
              and not exists (select 1 from affectations a where lower(a.email) = lower(u.email))
           union
           select distinct a.email, a.promo_id from affectations a
            where a.role = 'formateur' and a.promo_id is not null and a.email not like '%@example.invalid'
           union
           select distinct a.email, p.id from affectations a join promos p on p.lieu_id = a.lieu_id
            where a.role = 'direction' and a.email not like '%@example.invalid' and p.id not in (v_pn, v_pd)
           union
           select u.email, p.id from user_profiles u cross join promos p
            where u.is_founder and u.email not like '%@example.invalid' and p.id not in (v_pn, v_pd) loop
    n_reel := n_reel + 1;
    select lieu_id into v_l from promos where id = r.promo;
    execute 'select count(*) from contacts where lieu_id = $1' into n using v_l;
    v := pg_temp.agir(r.email, r.promo, null,
      format('select count(*) filter (where lieu_id = %s) || ''/'' || count(*) from public.contacts', v_l), true);
    if v is distinct from format('%s/%s', n, n) then n_reel_ko := n_reel_ko + 1; end if;
  end loop;
  if n_reel > 0 and n_reel_ko = 0 then ok := ok + 1;
  else ko := ko || format('R comptes réels : %s couples compte et promo sur %s ne voient pas exactement les contacts de leur centre',
                          n_reel_ko, n_reel); end if;

  -- Verdict ---------------------------------------------------------------------------------------------------
  select md5(coalesce(string_agg(format('%s %s %s %s %s %s', policyname, permissive, cmd, roles, qual, with_check), ' | '
                                 order by policyname), '')) into v_regles
    from pg_policies where schemaname = 'public' and tablename = 'contacts';
  if cardinality(ko) = 0 then
    raise exception 'VERT %/0 (règles de contacts %, comptes réels : % couples compte et promo)', ok, v_regles, n_reel;
  else
    raise exception 'ROUGE %/% (règles de contacts %, comptes réels : % couples compte et promo) : %',
      ok, cardinality(ko), v_regles, n_reel, array_to_string(ko, ' | ');
  end if;
end $preuve$;
