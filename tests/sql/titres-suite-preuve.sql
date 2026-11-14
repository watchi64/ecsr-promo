-- Preuve de l'étape 3 du chantier « titres et droits à la carte » : ce que les migrations 20261115_titres_7 (correctifs), _8 (aperçu par
-- titre) et _9 (catalogue) doivent donner, écrite avec elles ; la migration 20261112_titres_4 (journal) s'y joue aussi, juste avant la 9,
-- pour l'essai à blanc de l'étape 4. Elle se joue sur la base de la production (titres 1, 2, 3, 5, 6 ; contacts ; e-learning) :
-- outils/base_locale/rejouer_suite.sh --production.
--   structure    prérequis de l'étape 2 présents (donner_titre, _refus_gestion, titres_ouverts : migration 6 appliquée), chaque migration et
--                chaque retour injectés se jouent sans erreur, personnages posés, aucune règle (policy) réécrite : md5 de pg_policies
--                (schéma public, trié collate "C") identique avant et après chaque migration 7, 8, 4 et 9.
--   retour       les retours défont tout, dans l'ordre inverse (9, 8, 7, 4) : l'empreinte (règles, fonctions, droits) égale celle d'avant.
-- Les groupes des migrations s'ajoutent avec leurs tâches (d1, d4, d5, m4m5, m7, apercu, ajustables, catalogue, journal_suite), chacun
-- derrière pg_temp.groupe_suite_a_jouer, qui juge la présence de sa migration par un marqueur (7 : l'index titres_version_unique ;
-- 8 : la fonction apercu_titre() ; 9 : six titres créés par la migration du catalogue ; 4 : la table journal_droits) :
--   - suite-en-ligne : un groupe dont la migration manque est sauté, avec une ligne d'information ;
--   - suite-contre-epreuve : chaque groupe est joué (il sort rouge si sa migration manque) ;
--   - modes injectés : un groupe dont la migration manque (ni injectée ni déjà appliquée) compte un échec et n'est pas joué.
--   Un groupe qui demande le journal est sauté, avec une information, quand la table journal_droits n'existe pas.
-- GABARIT, à ne pas jouer tel quel : outils/assembler_repetition_roles.mjs y colle les aides communes (tests/sql/roles-aides.sql,
-- tests/sql/titres-aides.sql, tests/sql/titres-gestion-aides.sql), le libellé du mode, la requête d'empreinte, puis les migrations 7, 8, 4
-- et 9 et leurs retours :
--   node outils/assembler_repetition_roles.mjs suite [--etapes 7|7,8|7,8,9|8|8,9|9|4,9] <sortie.sql>   7,8,9 par défaut : VERT attendu
--   node outils/assembler_repetition_roles.mjs suite-contre-epreuve <sortie.sql>   sans aucune migration : ROUGE attendu sur leurs groupes
--   node outils/assembler_repetition_roles.mjs suite-en-ligne <sortie.sql>         rien d'injecté, après application réelle
-- Une suite qui commence après la 7 (8, 8,9, 9, 4,9) suppose les migrations précédentes déjà appliquées sur la base : la preuve le
-- vérifie et refuse sinon ; une migration injectée qui est déjà appliquée est refusée de même. Le fichier assemblé se joue en une
-- requête ; le bloc do finit TOUJOURS par une levée : migrations, personnages et lignes d'essai sont annulés, rien ne reste.

-- @@INCLURE tests/sql/roles-aides.sql@@
-- @@INCLURE tests/sql/titres-aides.sql@@
-- @@INCLURE tests/sql/titres-gestion-aides.sql@@

create or replace function pg_temp.empreinte(out regles text, out fonctions text, out droits text)
language plpgsql as $tse$
begin
  execute
-- @@INJECTER tests/sql/roles-empreinte.sql@@
  into regles, fonctions, droits;
end $tse$;

-- Le md5 des règles (policies) du schéma public, triées collate "C" : aucune migration des étapes 3 et 4 n'en réécrit une.
create or replace function pg_temp.regles_md5()
returns text language sql as $tsr$
  select md5(coalesce(string_agg(concat_ws(' | ', tablename, policyname, permissive, array_to_string(roles, ','), cmd,
    coalesce(qual, '-'), coalesce(with_check, '-')), E'\n' order by tablename collate "C", policyname collate "C"), ''))
    from pg_policies where schemaname = 'public';
$tsr$;

-- Les titres posés par cette preuve, par nom court : R et R_promo. Leur identifiant en texte.
drop table if exists pg_temp.titres_suite;
create temp table titres_suite (nom text primary key, id text);

create or replace function pg_temp.titre_suite(p_nom text)
returns text language sql as $tst$
  select id from pg_temp.titres_suite where nom = p_nom;
$tst$;

-- Les personnages de l'étape 3, posés en propriétaire après ceux de l'étape 2 (poser_titres_gestion) : deux titres du réseau sans centre,
-- R (niveau centre, Promos et Équipe en Voir), porté par u au centre de la promo 1 et par v au centre de la promo 2, et R_promo (niveau
-- promo, Planning et Stagiaires en Voir), porté par personne. u et v reçoivent un profil (sans profil, la clé étrangère refuse
-- l'affectation). Tout nom posé ici commence par « Preuve9 » : aucun ne heurte le catalogue de la migration 9 (index titres_portee_nom).
create or replace function pg_temp.poser_titres_suite()
returns void language plpgsql as $tsp$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l2 integer := (select lieu_id from public.promos where id = 2);
  v_r text; v_rp text;
begin
  v_r := pg_temp.calcul(format('insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values (''Preuve9 réseau R'', ''centre'', null, %L::jsonb, ''preuve'') returning id::text',
    '{"promos":"voir","equipe":"voir"}'));
  v_rp := pg_temp.calcul(format('insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values (''Preuve9 réseau R promo'', ''promo'', null, %L::jsonb, ''preuve'') returning id::text',
    '{"planning":"voir","stagiaires":"voir"}'));
  insert into pg_temp.titres_suite (nom, id) values ('R', v_r), ('R_promo', v_rp);
  insert into public.user_profiles (email, role, is_admin, stagiaire_id)
    select email, role, false, null from pg_temp.perso where nom in ('u', 'v');
  perform pg_temp.affecter((select email from pg_temp.perso where nom = 'u'), 'direction', null, v_l1, v_r);
  perform pg_temp.affecter((select email from pg_temp.perso where nom = 'v'), 'direction', null, v_l2, v_r);
end $tsp$;

-- Un appel de fonction par un personnage, comme pg_temp.appeler_a de la preuve de gestion (en-tête de promo, aperçu du fondateur), avec en
-- plus l'en-tête x-apercu-titre quand p_titre n'est pas nul (request.headers reposé après pg_temp.contexte) : « OK <valeur> » (« nul » si
-- nulle) ou « ERREUR <état> <message> ». Rend la main au propriétaire. p_qui nul : un jeton sans adresse (rôle authenticated, aucun e-mail).
create or replace function pg_temp.appeler_t(p_qui text, p_entete text, p_apercu text, p_titre text, p_sql text)
returns text language plpgsql as $tsa$
declare v text; r text;
begin
  if p_qui is null then
    perform pg_temp.contexte('x@exemple.invalid', p_entete, p_apercu);
    perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
    set local role authenticated;
  else
    perform pg_temp.incarner((select email from pg_temp.perso where nom = p_qui), p_entete, p_apercu);
  end if;
  if p_titre is not null then
    perform set_config('request.headers',
      jsonb_strip_nulls(jsonb_build_object('x-promo-id', p_entete, 'x-apercu-role', p_apercu, 'x-apercu-titre', p_titre))::text, true);
  end if;
  begin
    execute p_sql into v;
    r := rtrim('OK ' || coalesce(v, 'nul'));
  exception when others then
    r := 'ERREUR ' || sqlstate || ' ' || sqlerrm;
  end;
  perform pg_temp.proprio();
  return r;
end $tsa$;

-- La migration d'une étape est-elle en place (injectée et jouée, ou déjà appliquée) ? Marqueurs : 7 l'index titres_version_unique ; 8 la
-- fonction apercu_titre() ; 9 six titres créés par la migration du catalogue ; 4 la table journal_droits.
create or replace function pg_temp.migration_presente(p_etape integer)
returns boolean language plpgsql as $tsm$
begin
  return case p_etape
    when 7 then to_regclass('public.titres_version_unique') is not null
    when 8 then to_regprocedure('public.apercu_titre()') is not null
    when 9 then (select count(*) from public.titres where cree_par = 'migration 20261115_titres_9_catalogue') = 6
    when 4 then to_regclass('public.journal_droits') is not null
  end;
end $tsm$;

-- Un groupe se joue-t-il dans ce mode ? p_etape : la migration qui le fonde ; p_journal : le groupe demande la table du journal.
create or replace function pg_temp.groupe_suite_a_jouer(p_groupe text, p_etape integer, p_mode text, p_journal boolean default false)
returns boolean language plpgsql as $tsg$
begin
  if p_journal and to_regclass('public.journal_droits') is null then
    perform pg_temp.informer('groupe ' || p_groupe, 'sauté : la table journal_droits n''existe pas (migration 4 ni appliquée ni injectée)');
    return false;
  end if;
  if p_mode like 'suite-contre-epreuve%' then return true; end if;
  if pg_temp.migration_presente(p_etape) then return true; end if;
  if p_mode like 'suite-en-ligne%' then
    perform pg_temp.informer('groupe ' || p_groupe, format('sauté : la migration %s n''est pas appliquée (mode en ligne)', p_etape));
  else
    perform pg_temp.verifier(p_groupe, format('la migration %s est en place (injectée ou déjà appliquée)', p_etape), false, 'mode ' || p_mode);
  end if;
  return false;
end $tsg$;

do $tsprg$
declare
  v_mode constant text :=
-- @@MODE@@
  ;
  v_m7 constant text :=
-- @@INJECTER supabase/migrations/20261115_titres_7_correctifs.sql@@
  ;
  v_m8 constant text :=
-- @@INJECTER supabase/migrations/20261115_titres_8_apercu.sql@@
  ;
  v_m4 constant text :=
-- @@INJECTER supabase/migrations/20261112_titres_4_journal.sql@@
  ;
  v_m9 constant text :=
-- @@INJECTER supabase/migrations/20261115_titres_9_catalogue.sql@@
  ;
  v_r9 constant text :=
-- @@INJECTER supabase/migrations/20261115_titres_9_catalogue_retour.sql@@
  ;
  v_r8 constant text :=
-- @@INJECTER supabase/migrations/20261115_titres_8_apercu_retour.sql@@
  ;
  v_r7 constant text :=
-- @@INJECTER supabase/migrations/20261115_titres_7_correctifs_retour.sql@@
  ;
  v_r4 constant text :=
-- @@INJECTER supabase/migrations/20261112_titres_4_journal_retour.sql@@
  ;
  v_debut constant timestamptz := clock_timestamp();
  v_en_ligne boolean;
  v_etapes integer[] := array[7, 8, 4, 9];
  v_textes text[];
  v_etats text[] := array[]::text[];
  v_retours text[];
  v_n integer;
  v_etat text;
  v_md5_depart text; v_md5 text;
  v_av_regles text; v_av_fonctions text; v_av_droits text;
  v_ap_regles text; v_ap_fonctions text; v_ap_droits text;
  v_jouees integer;
begin
  perform set_config('lock_timeout', '3s', true);
  v_en_ligne := v_mode like 'suite-en-ligne%';
  v_textes := array[v_m7, v_m8, v_m4, v_m9];
  -- Une migration injectée déjà appliquée, ou une suite qui commence après la 7 sans les précédentes en place : refus clair.
  for i in 1 .. 4 loop
    if v_textes[i] <> 'select 1' and pg_temp.migration_presente(v_etapes[i]) then
      raise exception 'REFUS : la migration % est déjà appliquée sur cette base (jouer suite-en-ligne) ; rien n''est changé', v_etapes[i];
    end if;
  end loop;
  if v_m8 <> 'select 1' and v_m7 = 'select 1' and not pg_temp.migration_presente(7) then
    raise exception 'REFUS : essai de la migration 8 sans la 7 : la migration 7 (20261115_titres_7_correctifs) n''est pas appliquée sur cette base ; rien n''est changé';
  end if;
  if v_m9 <> 'select 1' and ((v_m7 = 'select 1' and not pg_temp.migration_presente(7)) or (v_m8 = 'select 1' and not pg_temp.migration_presente(8))) then
    raise exception 'REFUS : essai de la migration 9 sans la 7 et la 8 : appliquer d''abord 20261115_titres_7_correctifs et 20261115_titres_8_apercu sur cette base ; rien n''est changé';
  end if;

  -- 1. Avant les migrations : l'empreinte de la base, puis les prérequis de l'étape 2 (migration 6 appliquée).
  select e.regles, e.fonctions, e.droits into v_av_regles, v_av_fonctions, v_av_droits from pg_temp.empreinte() e;
  v_md5_depart := pg_temp.regles_md5();
  perform pg_temp.verifier('structure', 'prérequis : donner_titre existe (migration 6 de l''étape 2)',
    to_regprocedure('public.donner_titre(text, bigint, integer, integer[], integer)') is not null);
  perform pg_temp.verifier('structure', 'prérequis : _refus_gestion existe (migration 6 de l''étape 2)',
    to_regprocedure('public._refus_gestion(text, integer, jsonb)') is not null);
  perform pg_temp.verifier('structure', 'prérequis : titres_ouverts existe (migration 6 de l''étape 2)',
    to_regprocedure('public.titres_ouverts()') is not null);

  -- 2. Les personnages, posés AVANT les migrations (comme les comptes de la production) : étape 1, étape 2, puis ceux de cette preuve.
  perform pg_temp.poser_perso();
  perform pg_temp.poser_titres_gestes();
  perform pg_temp.poser_titres_gestion();
  perform pg_temp.poser_titres_suite();
  perform pg_temp.attendre('structure', 'les personnages sont posés (4 titres non fixes de l''étape 2 portés ; R du réseau, niveau centre, porté au centre 1 par u et au centre 2 par v ; R_promo du réseau, niveau promo, non porté)',
    pg_temp.calcul(format($qs$select concat_ws('/',
      (select count(*) from perso where nom in ('t_chef', 't_vide', 't_qualite', 't_dirs') and info ~ '^[0-9]+$')::text,
      (select count(*) from public.titres where id = %1$s and nom = 'Preuve9 réseau R' and niveau = 'centre' and lieu_id is null and not fixe
         and cases = '{"promos":"voir","equipe":"voir"}'::jsonb)::text,
      (select count(*) from public.titres where id = %2$s and nom = 'Preuve9 réseau R promo' and niveau = 'promo' and lieu_id is null and not fixe
         and cases = '{"planning":"voir","stagiaires":"voir"}'::jsonb)::text,
      (select count(*) from public.affectations a join perso p on lower(a.email) = p.email
        where a.titre_id = %1$s and a.role = 'direction'
          and ((p.nom = 'u' and a.lieu_id = (select lieu_id from public.promos where id = 1))
            or (p.nom = 'v' and a.lieu_id = (select lieu_id from public.promos where id = 2))))::text,
      (select count(*) from public.affectations where titre_id = %2$s)::text,
      (select count(*) from public.titres where nom like 'Preuve9%%')::text)$qs$,
      coalesce(pg_temp.titre_suite('R'), 'null'), coalesce(pg_temp.titre_suite('R_promo'), 'null'))),
    '4/1/1/2/0/2');

  -- 3. Les migrations, dans l'ordre d'application (neutralisées dans les modes sans elles) : 7, 8, puis 4 juste avant 9. Après chacune,
  --    aucune règle réécrite : le md5 de pg_policies est celui d'avant elle.
  for i in 1 .. 4 loop
    v_md5 := pg_temp.regles_md5();
    v_etat := pg_temp.jouer('migration ' || v_etapes[i], v_textes[i]);
    perform pg_temp.etape('migration ' || v_etapes[i], v_etat, v_mode);
    if v_etat = 'jouée' then
      perform pg_temp.attendre('structure', format('migration %s : md5 de pg_policies (schéma public) identique avant et après (aucune règle réécrite)', v_etapes[i]),
        pg_temp.regles_md5(), v_md5);
    end if;
    v_etats := v_etats || v_etat;
  end loop;

  -- 4. Les groupes des migrations 7, 8, 9 et 4, avec leurs tâches, chacun derrière pg_temp.groupe_suite_a_jouer.

  -- 5. Les retours, dans l'ordre inverse (9, 8, 7, 4). Avant eux, les affectations des titres non fixes partent (en propriétaire) : chaque
  --    retour de 6, 7, 8 et 9 refuse de se jouer tant qu'une personne porte un titre non fixe (garde D5). Une information, jamais un contrôle.
  perform pg_temp.informer('avant les retours', format('%s affectation(s) d''un titre non fixe retirée(s) (garde D5 des retours)',
    pg_temp.retirer_titres_non_fixes()));
  v_retours := array[v_r9, v_r8, v_r7, v_r4];
  for i in 1 .. 4 loop
    v_n := (array[9, 8, 7, 4])[i];
    perform pg_temp.etape('retour ' || v_n, pg_temp.jouer('retour ' || v_n, v_retours[i]), v_mode);
  end loop;
  select e.regles, e.fonctions, e.droits into v_ap_regles, v_ap_fonctions, v_ap_droits from pg_temp.empreinte() e;
  select count(*) into v_jouees from unnest(v_etats) x where x = 'jouée';
  if v_en_ligne or v_jouees = 0 then
    perform pg_temp.informer('retours', format('non jugeables (aucune migration injectée, ou déjà appliquées) ; empreinte du moment : regles %s, fonctions %s, droits %s',
      v_ap_regles, v_ap_fonctions, v_ap_droits));
  else
    perform pg_temp.attendre('retour', 'après les retours : empreinte regles identique à celle d''avant', v_ap_regles, v_av_regles);
    perform pg_temp.attendre('retour', 'après les retours : empreinte fonctions identique à celle d''avant', v_ap_fonctions, v_av_fonctions);
    perform pg_temp.attendre('retour', 'après les retours : empreinte droits identique à celle d''avant', v_ap_droits, v_av_droits);
    perform pg_temp.attendre('retour', 'après les retours : md5 de pg_policies identique à celui d''avant', pg_temp.regles_md5(), v_md5_depart);
  end if;
  perform pg_temp.informer('durée du bloc', to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0') || ' s');
  perform pg_temp.verdict_titres(v_mode, v_debut);
  raise exception 'la preuve doit finir par la levée du verdict';
end $tsprg$;
