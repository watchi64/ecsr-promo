-- Preuve : un stagiaire ne lit plus l'adresse e-mail (ni le reste du profil) des autres stagiaires de sa promo ; l'équipe
-- garde sa lecture ; la vue Notes garde ce qu'elle demandait aux profils (qui a masqué ses notes) par
-- fiches_notes_masquees() (migration 20261110_profils_email_stagiaires).
-- Rejouable à volonté : le bloc lève TOUJOURS une exception à la fin, qui annule toutes les données de test et porte le
-- verdict (« VERT n/0 » ou « ROUGE n/k : ... »), suivi des empreintes md5 de la règle de lecture et de la fonction.
-- Données fictives (adresses en example.invalid, promos 9995 et 9996). Les comptes réels ne sont lus qu'en comptes :
-- aucune adresse réelle n'est écrite ici ni rendue par le verdict.
--
-- Essai à blanc avant d'appliquer : outils/assembler_preuve_profils.mjs remplace la ligne « -- MIGRATION » par la
-- migration (mode essai : VERT attendu), ou par la migration puis son retour (mode retour : ROUGE attendu, et les
-- empreintes d'avant). Contre la base d'avant la migration (mode en-ligne avant application), les contrôles des
-- stagiaires sont ROUGES : c'est la fuite. Après application, le mode en-ligne est VERT, aux empreintes de l'essai.
--
-- Contrôles :
--   L  les fiches des AUTRES stagiaires dont le profil est lisible, par personnage (stagiaires, équipe, fondateur,
--      aperçu « Voir en tant que » stagiaire, promo d'un autre envoyée dans l'en-tête) ;
--   M  son propre profil reste lisible ;
--   N  fiches_notes_masquees() : la fiche masquée de la promo affichée, pour tous ses membres ; refusée sans compte ;
--   G  balayage : aucune colonne d'adresse (« mail » dans son nom) d'aucune table ou vue lisible par un compte connecté
--      ne rend à s1 ou s2 l'adresse d'un autre stagiaire de la base (hors comptes de l'équipe qui ont aussi une fiche) ;
--   R  comptes réels : aucun stagiaire ne lit le profil d'un autre ; chaque formateur, direction et le fondateur lit
--      tous les profils des stagiaires de chacune de ses promos ; la fonction rend à chacun la même liste.

set local lock_timeout = '3s';

do $preuve$
declare
  v_promo integer := 9996;
  v_autre integer := 9995;
  v_lieu integer;
  e_s1 text := 'preuve.profils.s1@example.invalid';          -- stagiaire de 9996
  e_s2 text := 'preuve.profils.s2@example.invalid';          -- stagiaire de 9996, notes masquées
  e_s3 text := 'preuve.profils.s3@example.invalid';          -- stagiaire de 9995
  e_form text := 'preuve.profils.formateur@example.invalid'; -- formateur de 9996
  e_dir text := 'preuve.profils.direction@example.invalid';  -- direction du lieu des deux promos
  e_fond text := 'preuve.profils.fondateur@example.invalid'; -- fondateur
  s1 integer; s2 integer; s3 integer;
  r record; c record; obtenu text; v text; n integer; total integer;
  v_autres text[];
  ok integer := 0; ko text[] := '{}';
  n_stag integer := 0; n_stag_ko integer := 0; n_equipe integer := 0; n_equipe_ko integer := 0;
  v_regle text; v_fonction text;
begin
  -- MIGRATION

  -- Données fictives ------------------------------------------------------------------
  select id into v_lieu from lieux order by id limit 1;
  insert into promos (id, lieu_id, nom, date_debut) values
    (v_promo, v_lieu, 'Preuve profils', current_date), (v_autre, v_lieu, 'Preuve profils bis', current_date);
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveS1', 'Profils', 991, v_promo, true) returning id into s1;
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveS2', 'Profils', 992, v_promo, true) returning id into s2;
  insert into stagiaires (prenom, nom, ordre, promo_id, actif) values ('PreuveS3', 'Profils', 993, v_autre, true) returning id into s3;
  insert into user_profiles (email, role, stagiaire_id, anonymous_notes) values
    (e_s1, 'stagiaire', s1, false), (e_s2, 'stagiaire', s2, true), (e_s3, 'stagiaire', s3, false);
  insert into user_profiles (email, role, is_admin) values (e_form, 'prof', true), (e_dir, 'prof', false);
  insert into user_profiles (email, role, is_admin, is_founder) values (e_fond, 'prof', true, true);
  insert into affectations (email, role, promo_id) values (e_form, 'formateur', v_promo);
  insert into affectations (email, role, lieu_id) values (e_dir, 'direction', v_lieu);

  -- L, M et N : chaque personnage, dans un contexte (promo envoyée, aperçu) ---------------------------------
  for r in select * from (values
    -- personnage, promo envoyée, aperçu, L attendu (fiches des autres), N attendu (fiches masquées)
    ('s1', e_s1, v_promo, '', '', 's2'),
    ('s2', e_s2, v_promo, '', '', 's2'),
    ('s3', e_s3, v_autre, '', '', ''),
    ('s3 envoie 9996', e_s3, v_promo, '', '', ''),
    ('formateur', e_form, v_promo, '', 's1,s2', 's2'),
    ('formateur envoie 9995', e_form, v_autre, '', '', ''),
    ('direction', e_dir, v_promo, '', 's1,s2', 's2'),
    ('direction sur 9995', e_dir, v_autre, '', 's3', ''),
    ('fondateur', e_fond, v_promo, '', 's1,s2', 's2'),
    ('fondateur sur 9995', e_fond, v_autre, '', 's3', ''),
    ('formateur en aperçu stagiaire', e_form, v_promo, 'stagiaire', '', 's2'),
    ('fondateur en aperçu stagiaire', e_fond, v_promo, 'stagiaire', '', 's2')
  ) as t(nom, email, promo, apercu, attendu_l, attendu_n)
  loop
    perform set_config('request.jwt.claims', json_build_object('email', r.email, 'role', 'authenticated')::text, true);
    perform set_config('request.headers', (case when r.apercu = '' then json_build_object('x-promo-id', r.promo::text)
      else json_build_object('x-promo-id', r.promo::text, 'x-apercu-role', r.apercu) end)::text, true);
    set local role authenticated;
    -- L : les fiches des autres stagiaires (fictifs) dont le profil est lisible.
    begin
      select coalesce(string_agg(case u.stagiaire_id when s1 then 's1' when s2 then 's2' when s3 then 's3' end, ','
                                 order by u.stagiaire_id), '')
        into obtenu from public.user_profiles u
       where u.stagiaire_id in (s1, s2, s3) and lower(u.email) <> lower(r.email);
    exception when others then obtenu := 'erreur ' || sqlerrm;
    end;
    reset role;
    if obtenu = r.attendu_l then ok := ok + 1;
    else ko := ko || format('L %s : profils de « %s », attendu « %s »', r.nom, obtenu, r.attendu_l); end if;
    -- N : les fiches masquées de la promo affichée.
    set local role authenticated;
    begin
      select coalesce(string_agg(case f when s1 then 's1' when s2 then 's2' when s3 then 's3' else 'autre' end, ','
                                 order by f), '')
        into obtenu from public.fiches_notes_masquees() f;
    exception when others then obtenu := 'erreur ' || sqlerrm;
    end;
    reset role;
    if obtenu = r.attendu_n then ok := ok + 1;
    else ko := ko || format('N %s : masquées « %s », attendu « %s »', r.nom, obtenu, r.attendu_n); end if;
  end loop;

  -- M : son propre profil, adresse comprise, reste lisible --------------------------------------------------
  for r in select * from (values ('s1', e_s1), ('s2', e_s2)) as t(nom, email) loop
    perform set_config('request.jwt.claims', json_build_object('email', r.email, 'role', 'authenticated')::text, true);
    perform set_config('request.headers', json_build_object('x-promo-id', v_promo::text)::text, true);
    set local role authenticated;
    select count(*) into n from public.user_profiles u where lower(u.email) = lower(r.email);
    reset role;
    if n = 1 then ok := ok + 1; else ko := ko || format('M %s : son profil lu %s fois', r.nom, n); end if;
  end loop;

  -- N sans compte : la fonction est refusée ; aucun profil lisible -----------------------------------------
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.headers', '', true);
  set local role anon;
  begin
    perform public.fiches_notes_masquees();
    v := 'exécutée';
  exception when insufficient_privilege then v := 'refusée';
  when others then v := 'erreur ' || sqlstate;
  end;
  begin
    select count(*) into n from public.user_profiles;
  exception when insufficient_privilege then n := 0;
  end;
  reset role;
  if v = 'refusée' then ok := ok + 1; else ko := ko || ('N sans compte : fiches_notes_masquees ' || v); end if;
  if n = 0 then ok := ok + 1; else ko := ko || format('L sans compte : %s profils lisibles', n); end if;

  -- G : balayage de toutes les colonnes d'adresse lisibles, pour s1 puis s2 ----------------------------------
  -- Les adresses cherchées : celles des comptes qui ont une fiche, sauf les comptes de l'équipe (le fondateur, qui peut
  -- avoir une fiche, et tout compte affecté), dont l'adresse d'auteur (QCM, thèmes, invitations) reste lisible comme
  -- celle du personnel : hors du périmètre de cette migration.
  for r in select * from (values ('s1', e_s1), ('s2', e_s2)) as t(nom, email) loop
    select array_agg(lower(u.email)) into v_autres from user_profiles u
     where u.stagiaire_id is not null and lower(u.email) <> lower(r.email) and not u.is_founder
       and not exists (select 1 from affectations a where lower(a.email) = lower(u.email));
    perform set_config('request.jwt.claims', json_build_object('email', r.email, 'role', 'authenticated')::text, true);
    perform set_config('request.headers', json_build_object('x-promo-id', v_promo::text)::text, true);
    v := ''; total := 0;
    for c in select col.table_name, col.column_name from information_schema.columns col
              where col.table_schema = 'public' and col.column_name ilike '%mail%'
                and has_column_privilege('authenticated', format('public.%I', col.table_name), col.column_name, 'SELECT')
              order by 1, 2 loop
      set local role authenticated;
      begin
        execute format('select count(*) from public.%I where lower(%I::text) = any($1)', c.table_name, c.column_name)
          into n using v_autres;
      exception when insufficient_privilege then n := 0;
      end;
      reset role;
      total := total + 1;
      if n > 0 then v := v || format(' %s.%s (%s)', c.table_name, c.column_name, n); end if;
    end loop;
    if v = '' and total > 0 then ok := ok + 1;
    else ko := ko || format('G %s : adresses d''autres stagiaires lisibles dans%s (colonnes balayées : %s)',
                            r.nom, coalesce(nullif(v, ''), ' aucune'), total); end if;
  end loop;

  -- R : comptes réels (hors fictifs de cette preuve), en comptes seulement ---------------------------------
  -- Stagiaires : dans la promo de sa fiche, aucun profil d'un autre stagiaire ; la fonction rend les fiches masquées
  -- de cette promo, calculées ici en propriétaire. Un compte qui a aussi une fiche mais fait partie de l'équipe (le
  -- fondateur, une affectation) est compté avec l'équipe, plus bas.
  for r in select u.email, s.promo_id,
                  coalesce((select string_agg(x.stagiaire_id::text, ',' order by x.stagiaire_id) from user_profiles x
                             join stagiaires y on y.id = x.stagiaire_id
                            where x.anonymous_notes and y.promo_id = s.promo_id), '') as masquees
             from user_profiles u join stagiaires s on s.id = u.stagiaire_id
            where u.email not like '%@example.invalid' and not u.is_founder
              and not exists (select 1 from affectations a where lower(a.email) = lower(u.email)) loop
    n_stag := n_stag + 1;
    perform set_config('request.jwt.claims', json_build_object('email', r.email, 'role', 'authenticated')::text, true);
    perform set_config('request.headers', json_build_object('x-promo-id', r.promo_id::text)::text, true);
    set local role authenticated;
    select count(*) into n from public.user_profiles x where x.stagiaire_id is not null and lower(x.email) <> lower(r.email);
    begin
      select coalesce(string_agg(f::text, ',' order by f), '') into v from public.fiches_notes_masquees() f;
    exception when others then v := 'erreur';
    end;
    reset role;
    if n <> 0 or v <> r.masquees then n_stag_ko := n_stag_ko + 1; end if;
  end loop;
  if n_stag_ko = 0 then ok := ok + 1;
  else ko := ko || format('R stagiaires réels : %s sur %s lisent le profil d''un autre stagiaire ou ne reçoivent pas leurs fiches masquées',
                          n_stag_ko, n_stag); end if;
  -- Équipe : chaque formateur (sa promo), chaque direction (les promos de son lieu), le fondateur (toutes les promos)
  -- lit tous les profils des stagiaires de la promo affichée.
  for r in select distinct a.email, a.promo_id as promo from affectations a
            where a.role = 'formateur' and a.promo_id is not null and a.email not like '%@example.invalid'
           union
           select distinct a.email, p.id from affectations a join promos p on p.lieu_id = a.lieu_id
            where a.role = 'direction' and a.email not like '%@example.invalid'
           union
           select u.email, p.id from user_profiles u cross join promos p
            where u.is_founder and u.email not like '%@example.invalid' and p.id not in (v_promo, v_autre) loop
    n_equipe := n_equipe + 1;
    select count(*) into total from user_profiles x join stagiaires y on y.id = x.stagiaire_id where y.promo_id = r.promo;
    perform set_config('request.jwt.claims', json_build_object('email', r.email, 'role', 'authenticated')::text, true);
    perform set_config('request.headers', json_build_object('x-promo-id', r.promo::text)::text, true);
    set local role authenticated;
    select count(*) into n from public.user_profiles x
     where x.stagiaire_id in (select y.id from public.stagiaires y where y.promo_id = r.promo);
    reset role;
    if n <> total then n_equipe_ko := n_equipe_ko + 1; end if;
  end loop;
  if n_equipe > 0 and n_equipe_ko = 0 then ok := ok + 1;
  else ko := ko || format('R équipe réelle : %s couples compte et promo sur %s ne lisent pas tous les profils de leurs stagiaires',
                          n_equipe_ko, n_equipe); end if;

  -- Verdict -------------------------------------------------------------------------------------------------
  select md5(pg_get_expr(p.polqual, p.polrelid)) into v_regle from pg_policy p
   where p.polname = 'user_profiles_lecture' and p.polrelid = 'public.user_profiles'::regclass;
  v_fonction := coalesce((select md5(pg_get_functiondef(p.oid)) from pg_proc p
                           where p.oid = to_regprocedure('public.fiches_notes_masquees()')), 'absente');
  if cardinality(ko) = 0 then
    raise exception 'VERT %/0 (règle %, fonction % ; comptes réels : % stagiaires, % couples équipe et promo)',
      ok, v_regle, v_fonction, n_stag, n_equipe;
  else
    raise exception 'ROUGE %/% (règle %, fonction % ; comptes réels : % stagiaires, % couples équipe et promo) : %',
      ok, cardinality(ko), v_regle, v_fonction, n_stag, n_equipe, array_to_string(ko, ' | ');
  end if;
end $preuve$;
