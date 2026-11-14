-- Preuve de l'étape 3 du chantier « titres et droits à la carte » : ce que les migrations 20261115_titres_7 (correctifs), _8 (aperçu par
-- titre) et _9 (catalogue) doivent donner, écrite avec elles ; la migration 20261112_titres_4 (journal) s'y joue aussi, juste avant la 9,
-- pour l'essai à blanc de l'étape 4. Elle se joue sur la base de la production (titres 1, 2, 3, 5, 6 ; contacts ; conservation de la
-- direction ; e-learning) :
-- outils/base_locale/rejouer_suite.sh --production.
--   structure    prérequis de l'étape 2 présents (donner_titre, _refus_gestion, titres_ouverts : migration 6 appliquée), chaque migration et
--                chaque retour injectés se jouent sans erreur, personnages posés, aucune règle (policy) réécrite : md5 de pg_policies
--                (schéma public, trié collate "C") identique avant et après chaque migration 7, 8, 4 et 9.
--   retour       les retours défont tout, dans l'ordre inverse (9, 8, 7, 4) : l'empreinte (règles, fonctions, droits) égale celle d'avant.
-- Les groupes des migrations s'ajoutent avec leurs tâches (d1, d4, d5, m4m5, m7, apercu, ajustables, catalogue, journal_suite), chacun
-- derrière pg_temp.groupe_suite_a_jouer, qui juge la présence de sa migration par un marqueur (7 : l'index titres_version_unique, ou
-- « Réservé au siège. » dans _refus_gestion ;
-- 8 : la fonction apercu_titre() ; 9 : six titres créés par la migration du catalogue ; 4 : la table journal_droits) :
--   - migration en place (déjà appliquée, ou injectée et jouée) : le groupe est joué, dans tous les modes ;
--   - suite-en-ligne : un groupe dont la migration manque est sauté, avec une ligne d'information ;
--   - suite-contre-epreuve : chaque groupe est joué (il sort rouge si sa migration manque) ;
--   - modes injectés : un groupe dont la migration n'est pas demandée (--etapes) est sauté, avec une information ; si elle est demandée
--     (injectée) et que son marqueur reste faux, un échec est compté et le groupe n'est pas joué. suite --etapes 7, 7,8, 8, 8,9 peuvent
--     donc sortir VERT.
--   Un groupe qui demande le journal est sauté, avec une information, quand la table journal_droits n'existe pas.
-- La décision est une fonction pure (pg_temp.sort_du_groupe), contrôlée cas par cas au groupe structure à chaque jeu de la preuve.
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

-- La migration d'une étape est-elle en place (injectée et jouée, ou déjà appliquée) ? Marqueurs : 7 l'index titres_version_unique (partie
-- B) ou la phrase « Réservé au siège. » dans _refus_gestion (partie A, D1 : la première écrite ; le retour 7 défait les deux) ; 8 la
-- fonction apercu_titre() ; 9 six titres créés par la migration du catalogue ; 4 la table journal_droits.
create or replace function pg_temp.migration_presente(p_etape integer)
returns boolean language plpgsql as $tsm$
begin
  return case p_etape
    when 7 then to_regclass('public.titres_version_unique') is not null
      or coalesce(position('titres: Réservé au siège.' in (select p.prosrc from pg_proc p
           where p.oid = to_regprocedure('public._refus_gestion(text, integer, jsonb)'))) > 0, false)
    when 8 then to_regprocedure('public.apercu_titre()') is not null
    when 9 then (select count(*) from public.titres where cree_par = 'migration 20261115_titres_9_catalogue') = 6
    when 4 then to_regclass('public.journal_droits') is not null
  end;
end $tsm$;

-- Les étapes injectées dans ce mode (leur texte n'est pas le littéral neutre), posées par le bloc avant les migrations.
drop table if exists pg_temp.etapes_injectees;
create temp table etapes_injectees (etape integer primary key);

-- Le sort d'un groupe, décision pure : « jouer », « sauter-journal », « sauter-en-ligne », « sauter-non-demandee » ou « echec ».
-- p_journal_requis : le groupe demande la table du journal ; p_journal : elle existe ; p_presente : le marqueur de sa migration est vrai ;
-- p_injectee : sa migration est injectée dans ce mode.
create or replace function pg_temp.sort_du_groupe(p_mode text, p_presente boolean, p_injectee boolean, p_journal_requis boolean, p_journal boolean)
returns text language sql immutable as $tsd$
  select case
    when p_journal_requis and not p_journal then 'sauter-journal'
    when p_mode like 'suite-contre-epreuve%' then 'jouer'
    when p_presente then 'jouer'
    when p_mode like 'suite-en-ligne%' then 'sauter-en-ligne'
    when not p_injectee then 'sauter-non-demandee'
    else 'echec'
  end;
$tsd$;

-- Un groupe se joue-t-il dans ce mode ? p_etape : la migration qui le fonde ; p_journal : le groupe demande la table du journal.
create or replace function pg_temp.groupe_suite_a_jouer(p_groupe text, p_etape integer, p_mode text, p_journal boolean default false)
returns boolean language plpgsql as $tsg$
declare v_sort text;
begin
  v_sort := pg_temp.sort_du_groupe(p_mode, pg_temp.migration_presente(p_etape),
    exists (select 1 from pg_temp.etapes_injectees where etape = p_etape), p_journal, to_regclass('public.journal_droits') is not null);
  if v_sort = 'sauter-journal' then
    perform pg_temp.informer('groupe ' || p_groupe, 'sauté : la table journal_droits n''existe pas (migration 4 ni appliquée ni injectée)');
  elsif v_sort = 'sauter-en-ligne' then
    perform pg_temp.informer('groupe ' || p_groupe, format('sauté : la migration %s n''est pas appliquée (mode en ligne)', p_etape));
  elsif v_sort = 'sauter-non-demandee' then
    perform pg_temp.informer('groupe ' || p_groupe, format('sauté : la migration %s n''est ni demandée dans ce mode ni appliquée', p_etape));
  elsif v_sort = 'echec' then
    perform pg_temp.verifier(p_groupe, format('la migration %s, injectée, est en place', p_etape), false, 'mode ' || p_mode);
  end if;
  return v_sort = 'jouer';
end $tsg$;

-- Les cas de pg_temp.sort_du_groupe, contrôlés au groupe structure : (mode, présente, injectée, journal requis, journal présent, attendu).
create or replace function pg_temp.controler_sort_du_groupe()
returns void language plpgsql as $tsc$
declare r record;
begin
  for r in select * from (values
      ('suite (etapes 7, 8 injectees)', true, true, false, false, 'jouer'),
      ('suite (etapes 7, 8 injectees)', true, false, false, false, 'jouer'),
      ('suite (etape 7 injectees)', false, false, false, false, 'sauter-non-demandee'),
      ('suite (etapes 8, 9 injectees)', false, true, false, false, 'echec'),
      ('suite (etapes 4, 9 injectees)', false, false, true, false, 'sauter-journal'),
      ('suite (etapes 4, 9 injectees)', true, true, true, true, 'jouer'),
      ('suite-en-ligne (aucune migration injectee)', false, false, false, false, 'sauter-en-ligne'),
      ('suite-en-ligne (aucune migration injectee)', true, false, false, false, 'jouer'),
      ('suite-en-ligne (aucune migration injectee)', true, false, true, false, 'sauter-journal'),
      ('suite-contre-epreuve (aucune migration injectee)', false, false, false, false, 'jouer'),
      ('suite-contre-epreuve (aucune migration injectee)', false, false, true, false, 'sauter-journal')
    ) c(mode, presente, injectee, journal_requis, journal, attendu)
  loop
    perform pg_temp.attendre('structure', format('aiguillage des groupes : %s, migration %s, %s, journal %s : %s', r.mode,
        case when r.presente then 'en place' else 'absente' end, case when r.injectee then 'injectée' else 'non injectée' end,
        case when not r.journal_requis then 'non requis' when r.journal then 'requis et présent' else 'requis et absent' end, r.attendu),
      pg_temp.sort_du_groupe(r.mode, r.presente, r.injectee, r.journal_requis, r.journal), r.attendu);
  end loop;
end $tsc$;

-- Le titre que porte un personnage (sa première affectation), en texte.
create or replace function pg_temp.titre_du_perso(p_nom text)
returns text language sql as $tstp$
  select pg_temp.calcul(format('select a.titre_id::text from public.affectations a join pg_temp.perso p on lower(a.email) = p.email where p.nom = %L order by a.id limit 1', p_nom));
$tstp$;

-- creer_titre, ajuster_titre, supprimer_titre, donner_titre et retirer_titre joués par un personnage (p_apercu : l'aperçu du fondateur ;
-- p_lieu en texte : « null » ou un identifiant). Créer rend « OK <identifiant> », ajuster « OK <identifiant>/<version créée>/<porteurs> »,
-- supprimer « OK supprime », donner « OK donne », retirer « OK <lignes retirées> » ; un refus « ERREUR <état> <message> ».
create or replace function pg_temp.creer_t(p_qui text, p_apercu text, p_depuis text, p_nom text, p_lieu text)
returns text language sql as $tsc1$
  select pg_temp.appeler_t(p_qui, null, p_apercu, null, format('select public.creer_titre(%s, %L, %s)::text', p_depuis, p_nom, p_lieu));
$tsc1$;

create or replace function pg_temp.ajuster_t(p_qui text, p_apercu text, p_titre text, p_lieu text, p_cases text)
returns text language sql as $tsc2$
  select pg_temp.appeler_t(p_qui, null, p_apercu, null, format(
    $q$select concat_ws('/', r->>'titre_id', r->>'version_creee', r->>'porteurs_bascules') from (select public.ajuster_titre(%s, %s, null, %L::jsonb) as r) q$q$,
    p_titre, p_lieu, p_cases));
$tsc2$;

create or replace function pg_temp.supprimer_t(p_qui text, p_titre text)
returns text language sql as $tsc3$
  select pg_temp.appeler_t(p_qui, null, null, null, format('select ''supprime'' from (select public.supprimer_titre(%s)) q', p_titre));
$tsc3$;

create or replace function pg_temp.donner_t(p_qui text, p_email text, p_titre text, p_lieu text)
returns text language sql as $tsc4$
  select pg_temp.appeler_t(p_qui, null, null, null, format('select ''donne'' from (select public.donner_titre(%L, %s, %s, null, null)) q', p_email, p_titre, p_lieu));
$tsc4$;

create or replace function pg_temp.retirer_t(p_qui text, p_email text, p_titre text, p_lieu text)
returns text language sql as $tsc5$
  select pg_temp.appeler_t(p_qui, null, null, null, format($q$select (public.retirer_titre(%L, %s, %s))->>'retirees'$q$, p_email, p_titre, p_lieu));
$tsc5$;

-- « OK <identifiant> » devient « OK » (un titre créé), « OK <id>/false/0 » devient « OK » (un titre ajusté sans version) ; le reste tel quel.
create or replace function pg_temp.ok_court(p_reponse text)
returns text language sql as $tsc6$
  select case when coalesce(p_reponse, '') ~ '^OK [0-9]+(/false/0)?$' then 'OK' else p_reponse end;
$tsc6$;

-- Groupe d1 (migration 7, partie A) : qui crée, ajuste et supprime les titres de centre et du réseau. Personnages des étapes 1 et 2
-- (t_secr, t_rh, t_interv au centre 1 ; t_chef, Équipe : Modifier au centre 1 ; t_dirs, réseau, Directions : Modifier ; t_qualite ;
-- dir_n, direction fixe du centre 1 ; siege, siège fixe ; fond, le fondateur) et R_promo de cette preuve. Le verrou des titres non fixes
-- est ouvert en propriétaire le temps du groupe (le don le demande), puis remis dans son état de départ (valeur lue avant, ou clé
-- absente). Les sept premiers cas étaient permis avant D1.
create or replace function pg_temp.groupe_d1()
returns void language plpgsql as $tsd1$
declare
  v_l1t text := (select lieu_id from public.promos where id = 1)::text;
  t_secr text := pg_temp.titre_du_perso('t_secr');
  t_rh text := pg_temp.titre_du_perso('t_rh');
  t_interv text := pg_temp.titre_du_perso('t_interv');
  t_qualite text := pg_temp.titre_du_perso('t_qualite');
  v_rp text := pg_temp.titre_suite('R_promo');
  v_r text := pg_temp.titre_suite('R');
  e_z text := (select email from pg_temp.perso where nom = 'z');
  c_plafond constant text := '{"promos":"modifier","stagiaires":"modifier","emargement":"voir","notes":"voir","equipe":"modifier","reglages":"modifier"}';
  v_libre text; v_libre2 text; v_cree text;
  v_verrou_avant text := pg_temp.calcul($q$select value from public.settings where promo_id is null and key = 'titres_ouverts'$q$);
begin
  perform pg_temp.essai($q$delete from public.settings where promo_id is null and key = 'titres_ouverts'$q$);
  perform pg_temp.essai($q$insert into public.settings (key, value, promo_id) values ('titres_ouverts', 'oui', null)$q$);
  v_libre := pg_temp.calcul($q$insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values ('Preuve9 d1 réseau libre', 'centre', null, '{"promos":"voir"}', 'preuve') returning id::text$q$);
  v_libre2 := pg_temp.calcul($q$insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values ('Preuve9 d1 réseau libre 2', 'centre', null, '{"promos":"voir"}', 'preuve') returning id::text$q$);
  perform pg_temp.verifier('d1', 'départ : titres de t_secr, t_rh, t_interv, t_qualite, R, R_promo lus ; deux titres du réseau de niveau centre non portés posés',
    concat_ws('/', t_secr, t_rh, t_interv, t_qualite, v_r, v_rp, v_libre, v_libre2) ~ '^[0-9]+(/[0-9]+){7}$',
    concat_ws('/', t_secr, t_rh, t_interv, t_qualite, v_r, v_rp, v_libre, v_libre2));

  -- Les sept refus de D1 (permis avant la migration 7).
  perform pg_temp.attendre('d1', 't_dirs (réseau, Directions : Modifier) crée un titre de centre au centre 1 depuis t_secr : refusé (42501)',
    pg_temp.creer_t('t_dirs', null, t_secr, 'Preuve9 d1 dirs centre', v_l1t), 'ERREUR 42501 titres: Réservé à l''équipe du centre.');
  perform pg_temp.attendre('d1', 't_dirs ajuste le titre de t_rh (centre 1) : refusé (42501)',
    pg_temp.ajuster_t('t_dirs', null, t_rh, v_l1t, '{"promos":"voir","equipe":"voir"}'), 'ERREUR 42501 titres: Réservé à l''équipe du centre.');
  perform pg_temp.attendre('d1', 't_dirs ajuste R (titre du réseau de niveau centre) depuis le centre 1, ce qui créerait la version du centre : refusé (42501)',
    pg_temp.ajuster_t('t_dirs', null, v_r, v_l1t, '{"promos":"voir","equipe":"voir"}'), 'ERREUR 42501 titres: Réservé à l''équipe du centre.');
  perform pg_temp.attendre('d1', 't_dirs crée un titre du réseau de niveau centre depuis t_secr : refusé (42501), réservé au siège',
    pg_temp.creer_t('t_dirs', null, t_secr, 'Preuve9 d1 dirs réseau centre', 'null'), 'ERREUR 42501 titres: Réservé au siège.');
  perform pg_temp.attendre('d1', 't_dirs ajuste R_promo sans centre : refusé (42501), réservé au siège',
    pg_temp.ajuster_t('t_dirs', null, v_rp, 'null', '{"planning":"voir","stagiaires":"voir"}'), 'ERREUR 42501 titres: Réservé au siège.');
  -- D1 étendu à la création d'un titre du réseau de niveau promo (décision de Timy du 14/11).
  perform pg_temp.attendre('d1', 't_dirs crée un titre du réseau de niveau promo depuis t_interv, sans centre : refusé (42501), réservé au siège',
    pg_temp.creer_t('t_dirs', null, t_interv, 'Preuve9 d1 dirs réseau promo', 'null'), 'ERREUR 42501 titres: Réservé au siège.');
  perform pg_temp.attendre('d1', 't_dirs supprime un titre du réseau de niveau centre non porté : refusé (42501), réservé au siège (D1 couvre supprimer_titre)',
    pg_temp.supprimer_t('t_dirs', v_libre), 'ERREUR 42501 titres: Réservé au siège.');

  -- Ce que D1 ne change pas, et ce qu'il laisse permis.
  perform pg_temp.attendre('d1', 't_dirs donne le titre de t_secr à z au centre 1 : permis (donner ne change pas)',
    pg_temp.donner_t('t_dirs', e_z, t_secr, v_l1t), 'OK donne');
  perform pg_temp.attendre('d1', 't_dirs retire ce titre à z : permis (retirer ne change pas), une ligne',
    pg_temp.retirer_t('t_dirs', e_z, t_secr, v_l1t), 'OK 1');
  perform pg_temp.attendre('d1', 't_dirs crée un titre de niveau réseau depuis t_qualite (au plus égal) : permis',
    pg_temp.ok_court(pg_temp.creer_t('t_dirs', null, t_qualite, 'Preuve9 d1 dirs réseau', 'null')), 'OK');
  perform pg_temp.attendre('d1', 'siege crée un titre de centre au centre 1 depuis t_secr : permis',
    pg_temp.ok_court(pg_temp.creer_t('siege', null, t_secr, 'Preuve9 d1 siège centre', v_l1t)), 'OK');
  v_cree := pg_temp.creer_t('siege', null, t_interv, 'Preuve9 d1 siège réseau promo', 'null');
  perform pg_temp.attendre('d1', 'siege crée un titre du réseau de niveau promo depuis t_interv, sans centre : permis',
    pg_temp.ok_court(v_cree), 'OK');
  perform pg_temp.attendre('d1', 'siege ajuste ce titre du réseau de niveau promo, sans centre : permis, aucune version',
    pg_temp.ok_court(pg_temp.ajuster_t('siege', null, substr(v_cree, 4), 'null', '{"planning":"voir","stagiaires":"voir"}')), 'OK');
  -- Miroir du refus de t_dirs sur R : le siège ajuste depuis le centre 1 un titre du réseau de niveau centre, la version du centre naît.
  -- Joué sur un second titre libre (non porté, que la contre-épreuve ne supprime pas) plutôt que sur R, pour que u reste sur R pour
  -- les groupes suivants : aucun porteur ne bascule.
  perform pg_temp.attendre('d1', 'siege ajuste depuis le centre 1 un titre du réseau de niveau centre non porté : permis, version du centre créée, aucun porteur basculé',
    regexp_replace(coalesce(pg_temp.ajuster_t('siege', null, v_libre2, v_l1t, '{"promos":"voir","equipe":"voir"}'), 'nul'), '^OK [0-9]+/', 'OK <version>/'), 'OK <version>/true/0');
  v_cree := pg_temp.creer_t('dir_n', null, t_secr, 'Preuve9 d1 direction centre', v_l1t);
  perform pg_temp.attendre('d1', 'dir_n (direction fixe du centre 1) crée un titre de centre au centre 1 depuis t_secr : permis',
    pg_temp.ok_court(v_cree), 'OK');
  -- Les cases d'une direction fixe valent le plafond du centre : aucune ne peut les dépasser, l'exemption « direction fixe » de la règle
  -- 3 n'a donc pas d'effet observable (un mutant qui la retire reste vert) ; le cas montre seulement que le plafond est permis.
  perform pg_temp.attendre('d1', 'dir_n l''ajuste au plafond du centre : permis',
    pg_temp.ok_court(pg_temp.ajuster_t('dir_n', null, substr(v_cree, 4), v_l1t, c_plafond)), 'OK');
  perform pg_temp.attendre('d1', 't_chef (Équipe : Modifier) crée depuis t_rh au centre 1 : permis',
    pg_temp.ok_court(pg_temp.creer_t('t_chef', null, t_rh, 'Preuve9 d1 chef centre', v_l1t)), 'OK');
  perform pg_temp.attendre('d1', 'le fondateur en aperçu siège crée un titre du réseau de niveau centre depuis R : permis (aperçu siège = siège fixe)',
    pg_temp.ok_court(pg_temp.creer_t('fond', 'siege', v_r, 'Preuve9 d1 aperçu siège', 'null')), 'OK');

  -- Le verrou retrouve son état de départ.
  perform pg_temp.essai($q$delete from public.settings where promo_id is null and key = 'titres_ouverts'$q$);
  if v_verrou_avant is not null then
    perform pg_temp.essai(format('insert into public.settings (key, value, promo_id) values (''titres_ouverts'', %L, null)', v_verrou_avant));
  end if;
  perform pg_temp.attendre('d1', 'fin du groupe : le verrou titres_ouverts est dans son état de départ',
    pg_temp.calcul($q$select value from public.settings where promo_id is null and key = 'titres_ouverts'$q$), v_verrou_avant);
end $tsd1$;

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
  insert into pg_temp.etapes_injectees (etape) select v_etapes[i] from generate_subscripts(v_etapes, 1) i where v_textes[i] <> 'select 1';
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
  perform pg_temp.controler_sort_du_groupe();

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
  if pg_temp.groupe_suite_a_jouer('d1', 7, v_mode) then
    perform pg_temp.groupe_d1();
  end if;

  -- 5. Les retours, dans l'ordre inverse (9, 8, 7, 4). Avant eux, dans les seuls modes qui injectent des retours, les affectations des
  --    titres non fixes partent (en propriétaire) : chaque retour de 6, 7, 8 et 9 refuse de se jouer tant qu'une personne porte un titre
  --    non fixe (garde D5). Jamais en ligne ni en contre-épreuve. Une information, jamais un contrôle.
  if v_mode like 'suite (%' then
    perform pg_temp.informer('avant les retours', format('%s affectation(s) d''un titre non fixe retirée(s) (garde D5 des retours)',
      pg_temp.retirer_titres_non_fixes()));
  end if;
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
