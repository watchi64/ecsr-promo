-- Preuve de l'étape 3 du chantier « titres et droits à la carte » : ce que les migrations 20261115_titres_7 (correctifs), _8 (aperçu par
-- titre) et _9 (catalogue) doivent donner, écrite avec elles ; la migration 20261112_titres_4 (journal) s'y joue aussi, juste avant la 9,
-- pour l'essai à blanc de l'étape 4. Elle se joue sur la base de la production (titres 1, 2, 3, 5, 6 ; contacts ; conservation de la
-- direction ; e-learning) :
-- outils/base_locale/rejouer_suite.sh --production.
--   structure    prérequis de l'étape 2 présents (donner_titre, _refus_gestion, titres_ouverts : migration 6 appliquée), chaque migration et
--                chaque retour injectés se jouent sans erreur, personnages posés, aucune règle (policy) réécrite : md5 de pg_policies
--                (schéma public, trié collate "C") identique avant et après chaque migration 7, 8, 4 et 9.
--   d5           (aides de gestion, pg_temp.groupe_d5) le retour 7, injecté, s'arrête sans rien changer tant qu'une affectation porte un
--                titre non fixe, avec la phrase D5 ; les affectations retirées, il passe ; les deux essais sont annulés. Le retour 8
--                de même, quand il est injecté.
--   apercu       (migration 8) l'aperçu du fondateur par titre (en-tête x-apercu-titre) ne fait que retirer : cases du titre bornées au
--                plafond, titres fixes faux pour un titre non fixe ; ignoré pour un autre niveau, un autre centre, un en-tête illisible,
--                et pour tout compte qui n'est pas le fondateur.
--   ajustables   (migration 8) mes_titres en aperçu (M10), titres_ajustables (centre et réseau, D1 de la migration 7), droits des
--                fonctions nouvelles, journal_present.
--   catalogue    (migration 9, partie A) les six titres du réseau mot pour mot (spec § 6.2), ce qu'en voit une direction fixe selon le
--                verrou, un don de Secrétariat et ce qu'il ouvre (stagiaires, aucune évaluation), la garde des noms (rejouée seulement
--                quand la migration 9 est injectée).
--   siege_lit    (migration 9, partie B) le siège fixe lit titres_visibles(centre), donnable jugé pour lui ; direction d'un autre centre,
--                stagiaire, titres non fixes du réseau refusés avec la phrase d'avant ; aucune autre fonction changée (md5 pris avant la
--                migration 9 quand elle est injectée). Le retour 9 remet titres_visibles d'avant (md5) et le nombre de titres.
--   retour       les retours défont tout, dans l'ordre inverse (9, 8, 7, 4) : l'empreinte (règles, fonctions, droits) égale celle d'avant.
-- Les groupes des migrations s'ajoutent avec leurs tâches (d1, d4, d5, m4m5, m7, apercu, ajustables, catalogue, siege_lit, journal_suite), chacun
-- derrière pg_temp.groupe_suite_a_jouer, qui juge la présence de sa migration par un marqueur (7 : l'index titres_version_unique,
-- « Réservé au siège. » dans _refus_gestion ou la phrase M4 dans donner_titre ;
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
-- B), la phrase « Réservé au siège. » dans _refus_gestion (partie A, D1) ou la phrase M4 « Une fiche formateur ne se relie qu'au titre
-- Formateur. » dans donner_titre (partie C) : une seule des trois suffit (les parties A, B et C forment un seul fichier ; le retour 7
-- défait les trois) ; 8 la fonction apercu_titre() ; 9 six titres créés par la migration du catalogue ; 4 la table journal_droits.
create or replace function pg_temp.migration_presente(p_etape integer)
returns boolean language plpgsql as $tsm$
begin
  return case p_etape
    when 7 then to_regclass('public.titres_version_unique') is not null
      or coalesce(position('titres: Réservé au siège.' in (select p.prosrc from pg_proc p
           where p.oid = to_regprocedure('public._refus_gestion(text, integer, jsonb)'))) > 0, false)
      or coalesce(position('titres: Une fiche formateur ne se relie qu''au titre Formateur.' in (select p.prosrc from pg_proc p
           where p.oid = to_regprocedure('public.donner_titre(text, bigint, integer, integer[], integer)'))) > 0, false)
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

-- Une écriture en propriétaire qui doit heurter une contrainte : « OK » ou « ERREUR <état> <nom de la contrainte> », le nom lu par get
-- stacked diagnostics (deux index uniques de titres donnent le même état 23505 : seul le nom les distingue).
create or replace function pg_temp.essai_contrainte(p_sql text)
returns text language plpgsql as $tsec$
declare v_contrainte text;
begin
  perform pg_temp.proprio();
  execute p_sql;
  return 'OK';
exception when others then
  get stacked diagnostics v_contrainte = constraint_name;
  return rtrim('ERREUR ' || sqlstate || ' ' || coalesce(v_contrainte, ''));
end $tsec$;

-- Groupe d4 (migration 7, partie B) : une seule version de centre par titre du réseau, en une session (la concurrence se prouve à deux
-- sessions par tests/sql/titres-concurrence.sh). Joué sur un titre du réseau de niveau centre posé par le groupe, non porté, et non sur
-- R : u reste porteur de R pour les groupes suivants. t_chef (Équipe : Modifier au centre 1) l'ajuste deux fois depuis le centre 1.
create or replace function pg_temp.groupe_d4()
returns void language plpgsql as $tsd4$
declare
  v_l1t text := (select lieu_id from public.promos where id = 1)::text;
  v_r4 text; v_un text; v_deux text; v_version text;
begin
  v_r4 := pg_temp.calcul($q$insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values ('Preuve9 d4 réseau', 'centre', null, '{"promos":"voir","equipe":"voir"}', 'preuve') returning id::text$q$);
  perform pg_temp.verifier('d4', 'départ : un titre du réseau de niveau centre, non porté, posé', coalesce(v_r4, '') ~ '^[0-9]+$', coalesce(v_r4, 'nul'));
  v_un := pg_temp.ajuster_t('t_chef', null, v_r4, v_l1t, '{"promos":"voir","equipe":"voir"}');
  v_version := substring(v_un from '^OK ([0-9]+)/');
  perform pg_temp.attendre('d4', 't_chef ajuste le titre depuis le centre 1 : la version du centre est créée (version_creee vrai)',
    regexp_replace(coalesce(v_un, 'nul'), '^OK [0-9]+/', 'OK <version>/'), 'OK <version>/true/0');
  v_deux := pg_temp.ajuster_t('t_chef', null, v_r4, v_l1t, '{"promos":"voir"}');
  perform pg_temp.attendre('d4', 't_chef l''ajuste une seconde fois : la même version est modifiée (version_creee faux, même identifiant)',
    v_deux, 'OK ' || coalesce(v_version, '?') || '/false/0');
  perform pg_temp.attendre('d4', 'une seule version du titre au centre 1, aux cases du second ajustement',
    pg_temp.calcul(format('select count(*)::text || ''/'' || min(cases::text) from public.titres where origine_id = %s and lieu_id = %s', v_r4, v_l1t)),
    '1/{"promos": "voir"}');
  perform pg_temp.attendre('d4', 'une seconde version posée en propriétaire pour le même titre et le même centre, d''un autre nom : refusée par l''index titres_version_unique (23505)',
    pg_temp.essai_contrainte(format($q$insert into public.titres (nom, niveau, lieu_id, origine_id, cases, cree_par) values ('Preuve9 autre version', 'centre', %s, %s, '{}', 'preuve')$q$, v_l1t, v_r4)),
    'ERREUR 23505 titres_version_unique');
  perform pg_temp.attendre('d4', 'l''index titres_version_unique est unique, sur (origine_id, lieu_id), avec le prédicat origine_id IS NOT NULL',
    pg_temp.calcul($q$select pg_get_indexdef('public.titres_version_unique'::regclass)$q$),
    'CREATE UNIQUE INDEX titres_version_unique ON public.titres USING btree (origine_id, lieu_id) WHERE (origine_id IS NOT NULL)');
end $tsd4$;

-- donner_titre avec des promos et une fiche formateur, joué par un personnage : « OK cree=…/transforme=… » ou l'erreur. p_promos et p_prof
-- en texte SQL (« '{1}'::integer[] », un identifiant ou « null »).
create or replace function pg_temp.donner_m(p_qui text, p_email text, p_titre text, p_lieu text, p_promos text, p_prof text)
returns text language sql as $tsm1$
  select pg_temp.appeler_t(p_qui, null, null, null, format(
    $q$select concat_ws('/', 'cree=' || (r->>'cree'), 'transforme=' || (r->>'transforme')) from (select public.donner_titre(%L, %s, %s, %s, %s) as r) q$q$,
    p_email, p_titre, p_lieu, p_promos, p_prof));
$tsm1$;

-- Le profil d'un personnage, en propriétaire : « rôle/is_admin/fiche formateur » (« nul » sans fiche), « aucun » sans profil.
create or replace function pg_temp.profil_m(p_nom text)
returns text language sql as $tsm2$
  select coalesce(pg_temp.calcul(format('select u.role || ''/'' || u.is_admin::text || ''/'' || coalesce(u.prof_id::text, ''nul'') from public.user_profiles u join pg_temp.perso p on lower(u.email) = lower(p.email) where p.nom = %L',
    p_nom)), 'aucun');
$tsm2$;

-- Groupe m4m5 (migration 7, partie C) : la fiche formateur et is_admin ne vont qu'au titre fixe Formateur. x, y : adresses libres
-- (ni profil ni affectation) ; orphelin : compte stagiaire sans fiche ; une fiche formateur libre posée en propriétaire. Le verrou des
-- titres non fixes est ouvert le temps du groupe, puis remis dans son état de départ.
create or replace function pg_temp.groupe_m4m5()
returns void language plpgsql as $tsm4$
declare
  v_l1t text := (select lieu_id from public.promos where id = 1)::text;
  t_interv text := pg_temp.titre_du_perso('t_interv');
  t_rh text := pg_temp.titre_du_perso('t_rh');
  t_form text := pg_temp.calcul($q$select public.titre_fixe('promo')::text$q$);
  t_dir text := pg_temp.calcul($q$select public.titre_fixe('centre')::text$q$);
  e_x text := (select email from pg_temp.perso where nom = 'x');
  e_y text := (select email from pg_temp.perso where nom = 'y');
  e_orph text := (select email from pg_temp.perso where nom = 'orphelin');
  e_form_m text := (select email from pg_temp.perso where nom = 'form_m');
  v_promos_1 constant text := '''{1}''::integer[]';
  v_fiche text; v_fiche2 text;
  v_verrou_avant text := pg_temp.calcul($q$select value from public.settings where promo_id is null and key = 'titres_ouverts'$q$);
begin
  perform pg_temp.essai($q$delete from public.settings where promo_id is null and key = 'titres_ouverts'$q$);
  perform pg_temp.essai($q$insert into public.settings (key, value, promo_id) values ('titres_ouverts', 'oui', null)$q$);
  v_fiche := pg_temp.calcul($q$insert into public.profs (nom) values ('Preuve9 fiche libre') returning id::text$q$);
  v_fiche2 := pg_temp.calcul($q$insert into public.profs (nom) values ('Preuve9 fiche libre deux') returning id::text$q$);
  perform pg_temp.verifier('m4m5', 'départ : Intervenant, Formateur, Direction de centre lus ; x, y libres ; orphelin sans fiche ; deux fiches libres posées',
    concat_ws('/', t_interv, t_form, t_dir, v_fiche, v_fiche2) ~ '^[0-9]+(/[0-9]+){4}$' and pg_temp.profil_m('x') = 'aucun'
      and pg_temp.profil_m('y') = 'aucun' and pg_temp.profil_m('orphelin') = 'stagiaire/false/nul',
    concat_ws(' ', t_interv, t_form, t_dir, v_fiche, v_fiche2, pg_temp.profil_m('x'), pg_temp.profil_m('y'), pg_temp.profil_m('orphelin')));

  -- M4 : une fiche formateur ne se relie qu'au titre fixe Formateur ; refus après le droit, avant toute écriture.
  perform pg_temp.attendre('m4m5', 't_chef donne Intervenant à x avec une fiche formateur : refusé, aucun profil créé',
    pg_temp.donner_m('t_chef', e_x, t_interv, v_l1t, v_promos_1, v_fiche) || ' / ' || pg_temp.profil_m('x'),
    'ERREUR P0001 titres: Une fiche formateur ne se relie qu''au titre Formateur. / aucun');
  perform pg_temp.attendre('m4m5', 't_chef donne Intervenant à l''orphelin avec une fiche formateur : refusé, le compte reste stagiaire',
    pg_temp.donner_m('t_chef', e_orph, t_interv, v_l1t, v_promos_1, v_fiche) || ' / ' || pg_temp.profil_m('orphelin'),
    'ERREUR P0001 titres: Une fiche formateur ne se relie qu''au titre Formateur. / stagiaire/false/nul');
  perform pg_temp.attendre('m4m5', 'siege donne Direction de centre (titre fixe, niveau centre) à x avec une fiche formateur : refusé, aucun profil créé',
    pg_temp.donner_m('siege', e_x, t_dir, v_l1t, 'null', v_fiche) || ' / ' || pg_temp.profil_m('x'),
    'ERREUR P0001 titres: Une fiche formateur ne se relie qu''au titre Formateur. / aucun');
  perform pg_temp.attendre('m4m5', 't_chef donne le titre de t_rh (niveau centre) à x avec une fiche formateur : refusé, aucun profil créé',
    pg_temp.donner_m('t_chef', e_x, t_rh, v_l1t, 'null', v_fiche) || ' / ' || pg_temp.profil_m('x'),
    'ERREUR P0001 titres: Une fiche formateur ne se relie qu''au titre Formateur. / aucun');
  perform pg_temp.attendre('m4m5', 't_rh (sans droit) donne Intervenant à x avec une fiche : le refus du droit d''abord (42501)',
    pg_temp.donner_m('t_rh', e_x, t_interv, v_l1t, v_promos_1, v_fiche),
    'ERREUR 42501 titres: Réservé à l''équipe du centre.');

  -- M5 : un titre de promo non fixe fait un profil du personnel sans is_admin.
  perform pg_temp.attendre('m4m5', 't_chef donne Intervenant à x sans fiche : permis, profil créé',
    pg_temp.donner_m('t_chef', e_x, t_interv, v_l1t, v_promos_1, 'null'), 'OK cree=true/transforme=false');
  perform pg_temp.attendre('m4m5', 'le profil de x : rôle prof, is_admin faux, aucune fiche',
    pg_temp.profil_m('x'), 'prof/false/nul');
  perform pg_temp.attendre('m4m5', 't_chef donne Intervenant à l''orphelin : permis, le compte est transformé',
    pg_temp.donner_m('t_chef', e_orph, t_interv, v_l1t, v_promos_1, 'null'), 'OK cree=false/transforme=true');
  perform pg_temp.attendre('m4m5', 'le profil de l''orphelin : rôle prof, is_admin faux',
    pg_temp.profil_m('orphelin'), 'prof/false/nul');

  -- Le titre fixe Formateur, inchangé : is_admin vrai, la fiche libre reliée.
  perform pg_temp.attendre('m4m5', 'dir_n donne Formateur à y avec une fiche libre : permis, profil créé',
    pg_temp.donner_m('dir_n', e_y, t_form, v_l1t, v_promos_1, v_fiche), 'OK cree=true/transforme=false');
  perform pg_temp.attendre('m4m5', 'le profil de y : rôle prof, is_admin vrai, la fiche reliée',
    pg_temp.profil_m('y'), 'prof/true/' || v_fiche);
  -- is_admin d'un profil existant n'est jamais relevé : x (Intervenant) devient Formateur et garde is_admin faux (sans effet : la colonne
  -- n'ouvre plus aucun droit). La fiche ne se relie pas davantage : donner_titre ne la pose qu'à la création du profil ou à la
  -- transformation d'un orphelin (comportement de l'étape 2b, inchangé).
  perform pg_temp.attendre('m4m5', 'dir_n donne Formateur à x (Intervenant) avec la seconde fiche : permis, Intervenant remplacé',
    pg_temp.donner_m('dir_n', e_x, t_form, v_l1t, v_promos_1, v_fiche2), 'OK cree=false/transforme=false');
  perform pg_temp.attendre('m4m5', 'le profil de x : is_admin reste faux (jamais relevé), aucune fiche (un profil existant ne la reçoit pas)',
    pg_temp.profil_m('x'), 'prof/false/nul');

  -- regler_affectations_formateur ne change pas (réponses de l'étape 2b) : dir_n règle form_m (Formateur de la promo 2) sur le centre 1.
  perform pg_temp.attendre('m4m5', 'dir_n règle form_m sur le centre 1, promo 1 : une ligne ajoutée',
    pg_temp.appeler_t('dir_n', '1', null, null, format($q$select (public.regler_affectations_formateur(%L, %s, '{1}'::integer[]))->>'ajoutees'$q$, e_form_m, v_l1t)),
    'OK [1]');
  perform pg_temp.attendre('m4m5', 'dir_n retire form_m de la promo 1 (liste vide) : une ligne retirée ; le profil de form_m garde is_admin vrai',
    pg_temp.appeler_t('dir_n', '1', null, null, format($q$select (public.regler_affectations_formateur(%L, %s, '{}'::integer[]))->>'retirees'$q$, e_form_m, v_l1t))
      || ' / ' || pg_temp.profil_m('form_m'),
    'OK [1] / prof/true/nul');
  perform pg_temp.attendre('m4m5', 'dir_n règle form_m sur le centre 2 : refusé (42501), réservé à la direction du centre',
    pg_temp.appeler_t('dir_n', '1', null, null, format($q$select (public.regler_affectations_formateur(%L, %s, '{2}'::integer[]))->>'ajoutees'$q$,
      e_form_m, (select lieu_id from public.promos where id = 2))),
    'ERREUR 42501 equipe: Réservé à la direction du centre.');

  -- Le ménage : x, y et l'orphelin redeviennent ce qu'ils étaient (les autres groupes peuvent les attendre libres).
  perform pg_temp.essai(format('delete from public.user_profiles where lower(email) in (%L, %L)', e_x, e_y));
  perform pg_temp.essai(format('delete from public.affectations where lower(email) = %L', e_orph));
  perform pg_temp.essai(format('update public.user_profiles set role = ''stagiaire'', is_admin = false, invited_by_email = null, prof_id = null where lower(email) = %L', e_orph));
  perform pg_temp.essai($q$delete from public.settings where promo_id is null and key = 'titres_ouverts'$q$);
  if v_verrou_avant is not null then
    perform pg_temp.essai(format('insert into public.settings (key, value, promo_id) values (''titres_ouverts'', %L, null)', v_verrou_avant));
  end if;
  perform pg_temp.attendre('m4m5', 'fin du groupe : x et y libres, l''orphelin stagiaire, le verrou titres_ouverts dans son état de départ',
    pg_temp.profil_m('x') || ' / ' || pg_temp.profil_m('y') || ' / ' || pg_temp.profil_m('orphelin') || ' / '
      || coalesce(pg_temp.calcul($q$select value from public.settings where promo_id is null and key = 'titres_ouverts'$q$), 'absent'),
    'aucun / aucun / stagiaire/false/nul / ' || coalesce(v_verrou_avant, 'absent'));
end $tsm4$;

-- ajuster_titre avec un nom, joué par un personnage : « OK <identifiant>/<version créée>/<porteurs> » ou l'erreur.
create or replace function pg_temp.ajuster_nom_t(p_qui text, p_titre text, p_lieu text, p_nom text, p_cases text)
returns text language sql as $tsm5$
  select pg_temp.appeler_t(p_qui, null, null, null, format(
    $q$select concat_ws('/', r->>'titre_id', r->>'version_creee', r->>'porteurs_bascules') from (select public.ajuster_titre(%s, %s, %L, %L::jsonb) as r) q$q$,
    p_titre, p_lieu, p_nom, p_cases));
$tsm5$;

-- Groupe m7 (migration 7, partie C) : un nom ne reprend pas celui d'un titre de l'autre portée. Noms à préfixe « Preuve9 ». La casse est
-- celle de la base : la variante en majuscules se calcule par upper() (la base locale, en ctype C, ne plie pas les lettres accentuées ;
-- l'index titres_portee_nom, lower(nom), non plus : la règle M7 suit le même lower()).
create or replace function pg_temp.groupe_m7()
returns void language plpgsql as $tsm7$
declare
  v_l1t text := (select lieu_id from public.promos where id = 1)::text;
  t_rh text := pg_temp.titre_du_perso('t_rh');
  t_secr text := pg_temp.titre_du_perso('t_secr');
  t_qualite text := pg_temp.titre_du_perso('t_qualite');
  c_rh constant text := '{"promos":"voir","equipe":"voir"}';
  v_secr text; v_r7 text; v_acc text; v_un text; v_version text; v_maj text;
  m_reseau constant text := 'ERREUR P0001 titres: Un titre du réseau porte déjà ce nom : choisissez-en un autre.';
  m_centre constant text := 'ERREUR P0001 titres: Un centre a déjà un titre de ce nom : choisissez-en un autre.';
begin
  v_secr := pg_temp.calcul($q$insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values ('Preuve9 secrétariat', 'centre', null, '{"promos":"voir","equipe":"voir"}', 'preuve') returning id::text$q$);
  v_r7 := pg_temp.calcul($q$insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values ('Preuve9 m7 réseau', 'centre', null, '{"promos":"voir","equipe":"voir"}', 'preuve') returning id::text$q$);
  v_maj := pg_temp.calcul($q$select upper('Preuve9 secrétariat')$q$);
  perform pg_temp.verifier('m7', 'départ : deux titres du réseau non fixes (niveau centre, non portés) posés en propriétaire ; titres de t_rh, t_secr, t_qualite lus',
    concat_ws('/', v_secr, v_r7, t_rh, t_secr, t_qualite) ~ '^[0-9]+(/[0-9]+){4}$', concat_ws('/', v_secr, v_r7, t_rh, t_secr, t_qualite));

  -- Un titre de centre ne prend pas le nom d'un titre du réseau non fixe.
  perform pg_temp.attendre('m7', 't_chef crée au centre 1, depuis t_rh, un titre nommé comme « Preuve9 secrétariat » en majuscules : refusé',
    pg_temp.creer_t('t_chef', null, t_rh, v_maj, v_l1t), m_reseau);
  perform pg_temp.attendre('m7', 't_rh (sans droit) crée « Preuve9 secrétariat » au centre 1 : le refus du droit d''abord (42501)',
    pg_temp.creer_t('t_rh', null, t_rh, 'Preuve9 secrétariat', v_l1t), 'ERREUR 42501 titres: Réservé à l''équipe du centre.');
  v_acc := pg_temp.creer_t('t_chef', null, t_rh, 'Preuve9 accueil', v_l1t);
  perform pg_temp.attendre('m7', 't_chef crée « Preuve9 accueil » au centre 1 (nom libre) : permis', pg_temp.ok_court(v_acc), 'OK');
  v_acc := substr(v_acc, 4);

  -- Un titre du réseau ne prend pas le nom d'un titre créé par un centre.
  perform pg_temp.attendre('m7', 'siege crée au réseau (niveau centre, sans centre), depuis t_secr, « Preuve9 accueil » : refusé',
    pg_temp.creer_t('siege', null, t_secr, 'Preuve9 accueil', 'null'), m_centre);
  perform pg_temp.attendre('m7', 'siege crée un titre de niveau réseau, depuis t_qualite, « PREUVE9 ACCUEIL » : refusé',
    pg_temp.creer_t('siege', null, t_qualite, 'PREUVE9 ACCUEIL', 'null'), m_centre);

  -- La version de centre d'un titre du réseau garde son nom ; le titre lui-même, sa racine et ses versions sont écartés.
  v_un := pg_temp.ajuster_nom_t('t_chef', v_r7, v_l1t, 'Preuve9 m7 réseau', c_rh);
  v_version := substring(v_un from '^OK ([0-9]+)/');
  perform pg_temp.attendre('m7', 't_chef ajuste « Preuve9 m7 réseau » depuis le centre 1 sous son propre nom : permis, la version du centre est créée',
    regexp_replace(coalesce(v_un, 'nul'), '^OK [0-9]+/', 'OK <version>/'), 'OK <version>/true/0');
  perform pg_temp.attendre('m7', 't_chef ajuste la version elle-même, même nom : permis, la même version',
    pg_temp.ajuster_nom_t('t_chef', coalesce(v_version, '-1'), v_l1t, 'Preuve9 m7 réseau', c_rh), 'OK ' || coalesce(v_version, '?') || '/false/0');
  perform pg_temp.attendre('m7', 't_chef renomme la version du centre « Preuve9 secrétariat » : refusé',
    pg_temp.ajuster_nom_t('t_chef', coalesce(v_version, '-1'), v_l1t, 'Preuve9 secrétariat', c_rh), m_reseau);
  perform pg_temp.attendre('m7', 'siege ajuste « Preuve9 secrétariat » (réseau) sous son propre nom, sans centre : permis',
    pg_temp.ajuster_nom_t('siege', v_secr, 'null', 'Preuve9 secrétariat', c_rh), 'OK ' || v_secr || '/false/0');

  -- Renommer.
  perform pg_temp.attendre('m7', 't_chef renomme « Preuve9 accueil » en « Preuve9 secrétariat » en majuscules : refusé, le nom reste',
    pg_temp.ajuster_nom_t('t_chef', v_acc, v_l1t, v_maj, c_rh) || ' / ' || pg_temp.calcul(format('select nom from public.titres where id = %s', v_acc)),
    m_reseau || ' / Preuve9 accueil');
  perform pg_temp.attendre('m7', 't_chef renomme « Preuve9 accueil » en « Preuve9 accueil libre » : permis',
    pg_temp.ajuster_nom_t('t_chef', v_acc, v_l1t, 'Preuve9 accueil libre', c_rh) || ' / ' || pg_temp.calcul(format('select nom from public.titres where id = %s', v_acc)),
    'OK ' || v_acc || '/false/0 / Preuve9 accueil libre');
  perform pg_temp.attendre('m7', 'siege renomme « Preuve9 m7 réseau » (réseau) en « Preuve9 accueil libre » : refusé',
    pg_temp.ajuster_nom_t('siege', v_r7, 'null', 'Preuve9 accueil libre', c_rh), m_centre);
  perform pg_temp.attendre('m7', 'siege renomme « Preuve9 m7 réseau » (réseau) en « Preuve9 m7 réseau neuf » : permis',
    pg_temp.ajuster_nom_t('siege', v_r7, 'null', 'Preuve9 m7 réseau neuf', c_rh), 'OK ' || v_r7 || '/false/0');
  -- Une écriture du propriétaire n'est pas concernée : la table garde ses seuls index (un titre de centre du nom d'un titre du réseau).
  perform pg_temp.attendre('m7', 'le propriétaire pose au centre 2 un titre nommé « Preuve9 secrétariat » : permis (les index ne changent pas)',
    pg_temp.essai_contrainte(format($q$insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values ('Preuve9 secrétariat', 'centre', %s, '{}', 'preuve')$q$,
      (select lieu_id from public.promos where id = 2))),
    'OK');
end $tsm7$;

-- Un appel en aperçu sur la promo 1 (x-promo-id 1, donc le centre 1 affiché) : p_apercu l'en-tête x-apercu-role, p_titre l'en-tête
-- x-apercu-titre (nul : absent).
create or replace function pg_temp.ap(p_qui text, p_apercu text, p_titre text, p_sql text)
returns text language sql as $tsap1$
  select pg_temp.appeler_t(p_qui, '1', p_apercu, p_titre, p_sql);
$tsap1$;

-- Groupe apercu (migration 8) : l'aperçu du fondateur par titre ne fait que retirer, et seulement pour le fondateur. Le titre simulé doit
-- être du niveau de l'aperçu (formateur : promo ; direction : centre ; siège : réseau) et du réseau ou du centre affiché. Personnages des
-- étapes 1 et 2 (t_interv : Intervenant de la promo 1 ; t_secr : Secrétariat du centre 1 ; t_contenus : réseau, Cours sur Modifier ;
-- form_n, dir_n : Formateur et Direction fixes) ; un titre de centre du centre 2 posé ici.
create or replace function pg_temp.groupe_apercu()
returns void language plpgsql as $tsap2$
declare
  v_l1t text := (select lieu_id from public.promos where id = 1)::text;
  t_interv text := pg_temp.titre_du_perso('t_interv');
  t_secr text := pg_temp.titre_du_perso('t_secr');
  t_contenus text := pg_temp.titre_du_perso('t_contenus');
  t_form text := pg_temp.calcul($q$select public.titre_fixe('promo')::text$q$);
  v_r text := pg_temp.titre_suite('R');
  v_rp text := pg_temp.titre_suite('R_promo');
  v_c2 text;
  c_pages constant text := $q$select string_agg(x.page || '=' || public.case_promo(1, x.page), ' ' order by x.n)
    from unnest(array['planning', 'emargement', 'stagiaires', 'notes', 'cours', 'ccp2', 'indicateurs', 'reglages']) with ordinality x(page, n)$q$;
  c_form constant text := $q$select public.case_promo(1, 'notes')::text || '/' || public.formateur_fixe(1)::text || '/' || public.geste_promo(1, 'stagiaires.supprimer')::text$q$;
  v_dir text;
begin
  v_c2 := pg_temp.calcul(format($q$insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values ('Preuve9 aperçu centre 2', 'centre', %s, '{"promos":"voir"}', 'preuve') returning id::text$q$,
    (select lieu_id from public.promos where id = 2)));
  v_dir := format($q$select public.case_centre(%1$s, 'notes')::text || '/' || public.direction_fixe(%1$s)::text$q$, v_l1t);
  perform pg_temp.verifier('apercu', 'départ : titres de t_interv, t_secr, t_contenus, Formateur, R, R_promo lus ; un titre de centre du centre 2 posé',
    concat_ws('/', t_interv, t_secr, t_contenus, t_form, v_r, v_rp, v_c2) ~ '^[0-9]+(/[0-9]+){6}$', concat_ws('/', t_interv, t_secr, t_contenus, t_form, v_r, v_rp, v_c2));

  -- Le fondateur en aperçu formateur sur la promo 1, avec le titre de t_interv (Planning, Stagiaires, Cours sur Voir ; Émargement sur Modifier).
  perform pg_temp.attendre('apercu', 'fondateur, aperçu formateur + titre de t_interv : case_promo(1, emargement) vaut 2',
    pg_temp.ap('fond', 'formateur', t_interv, $q$select public.case_promo(1, 'emargement')::text$q$), 'OK 2');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu formateur + titre de t_interv : case_promo(1, notes) vaut 0',
    pg_temp.ap('fond', 'formateur', t_interv, $q$select public.case_promo(1, 'notes')::text$q$), 'OK 0');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu formateur + titre de t_interv : formateur_fixe(1) faux',
    pg_temp.ap('fond', 'formateur', t_interv, $q$select public.formateur_fixe(1)::text$q$), 'OK false');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu formateur + titre de t_interv : geste_promo(1, notes.lire) faux',
    pg_temp.ap('fond', 'formateur', t_interv, $q$select public.geste_promo(1, 'notes.lire')::text$q$), 'OK false');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu formateur + titre de t_interv : geste_promo(1, emargement.tenir) vrai',
    pg_temp.ap('fond', 'formateur', t_interv, $q$select public.geste_promo(1, 'emargement.tenir')::text$q$), 'OK true');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu formateur + titre de t_interv : geste_promo(1, stagiaires.supprimer) faux (titre fixe seul)',
    pg_temp.ap('fond', 'formateur', t_interv, $q$select public.geste_promo(1, 'stagiaires.supprimer')::text$q$), 'OK false');
  -- Page par page : les cases du titre, jamais au-dessus du plafond (l'aperçu sans titre, ligne suivante).
  perform pg_temp.attendre('apercu', 'fondateur, aperçu formateur + titre de t_interv : les huit pages de la promo valent les cases du titre (Non 0, Voir 1, Modifier 2)',
    pg_temp.ap('fond', 'formateur', t_interv, c_pages), 'OK planning=1 emargement=2 stagiaires=1 notes=0 cours=1 ccp2=0 indicateurs=0 reglages=0');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu formateur sans en-tête de titre : les huit pages au plafond (réponses d''aujourd''hui)',
    pg_temp.ap('fond', 'formateur', null, c_pages), 'OK planning=2 emargement=2 stagiaires=2 notes=2 cours=2 ccp2=1 indicateurs=1 reglages=2');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu formateur sans en-tête de titre : case notes 2, formateur_fixe vrai, stagiaires.supprimer vrai',
    pg_temp.ap('fond', 'formateur', null, c_form), 'OK 2/true/true');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu formateur + le titre fixe Formateur désigné : comme sans en-tête',
    pg_temp.ap('fond', 'formateur', t_form, c_form), 'OK 2/true/true');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu formateur + R_promo (titre du réseau de niveau promo) : ses cases (Planning et Stagiaires sur Voir, Notes Non), formateur_fixe faux',
    pg_temp.ap('fond', 'formateur', v_rp, $q$select public.case_promo(1, 'planning')::text || '/' || public.case_promo(1, 'stagiaires')::text || '/' || public.case_promo(1, 'notes')::text || '/' || public.formateur_fixe(1)::text$q$),
    'OK 1/1/0/false');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu formateur + titre de t_secr (titre de centre) : ignoré, plafond et formateur_fixe vrai',
    pg_temp.ap('fond', 'formateur', t_secr, c_form), 'OK 2/true/true');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu formateur + en-tête « 12abc » : ignoré, aucune erreur',
    pg_temp.ap('fond', 'formateur', '12abc', c_form), 'OK 2/true/true');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu formateur + en-tête de 20 chiffres : ignoré, aucune erreur',
    pg_temp.ap('fond', 'formateur', '99999999999999999999', c_form), 'OK 2/true/true');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu formateur + identifiant inconnu : ignoré',
    pg_temp.ap('fond', 'formateur', '999999999', c_form), 'OK 2/true/true');

  -- Aperçu direction sur le centre 1.
  perform pg_temp.attendre('apercu', 'fondateur, aperçu direction + titre de t_secr : case_centre(l1, notes) 0, direction_fixe(l1) faux',
    pg_temp.ap('fond', 'direction', t_secr, v_dir), 'OK 0/false');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu direction + titre de t_secr : case_centre(l1, stagiaires) 2 (Modifier)',
    pg_temp.ap('fond', 'direction', t_secr, format($q$select public.case_centre(%s, 'stagiaires')::text$q$, v_l1t)), 'OK 2');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu direction sans en-tête de titre : case_centre(l1, notes) au plafond (1), direction_fixe(l1) vrai',
    pg_temp.ap('fond', 'direction', null, v_dir), 'OK 1/true');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu direction sur le centre 1 + un titre du centre 2 : ignoré',
    pg_temp.ap('fond', 'direction', v_c2, v_dir), 'OK 1/true');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu direction + R (titre du réseau de niveau centre) : ses cases (Promos et Équipe sur Voir, Notes Non), direction_fixe faux',
    pg_temp.ap('fond', 'direction', v_r, format($q$select public.case_centre(%1$s, 'promos')::text || '/' || public.case_centre(%1$s, 'equipe')::text || '/' || public.case_centre(%1$s, 'notes')::text || '/' || public.direction_fixe(%1$s)::text$q$, v_l1t)),
    'OK 1/1/0/false');

  -- Aperçu siège.
  perform pg_temp.attendre('apercu', 'fondateur, aperçu siège + titre de t_contenus : case_reseau(cours) 2, case_reseau(directions) 0, siege_fixe faux',
    pg_temp.ap('fond', 'siege', t_contenus, $q$select public.case_reseau('cours')::text || '/' || public.case_reseau('directions')::text || '/' || public.siege_fixe()::text$q$),
    'OK 2/0/false');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu siège + titre de t_secr (titre de centre) : ignoré, plafond et siege_fixe vrai',
    pg_temp.ap('fond', 'siege', t_secr, $q$select public.case_reseau('cours')::text || '/' || public.case_reseau('directions')::text || '/' || public.siege_fixe()::text$q$),
    'OK 2/2/true');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu siège + R (titre du réseau, mais de niveau centre) : ignoré, plafond et siege_fixe vrai',
    pg_temp.ap('fond', 'siege', v_r, $q$select public.case_reseau('cours')::text || '/' || public.case_reseau('directions')::text || '/' || public.siege_fixe()::text$q$),
    'OK 2/2/true');
  perform pg_temp.attendre('apercu', 'fondateur, aperçu direction + titre de t_interv (titre de promo du centre 1) : ignoré',
    pg_temp.ap('fond', 'direction', t_interv, v_dir), 'OK 1/true');

  -- Un compte qui n'est pas le fondateur : l'en-tête ne change rien.
  perform pg_temp.attendre('apercu', 'form_n (non fondateur), x-apercu-role formateur + x-apercu-titre de t_interv : ses propres réponses (2/true/true)',
    pg_temp.ap('form_n', 'formateur', t_interv, c_form), 'OK 2/true/true');
  perform pg_temp.attendre('apercu', 'form_n : les huit pages avec les deux en-têtes égalent celles sans en-tête',
    pg_temp.ap('form_n', 'formateur', t_interv, c_pages), pg_temp.ap('form_n', null, null, c_pages));
  perform pg_temp.attendre('apercu', 'dir_n (non fondateur), x-apercu-role direction + x-apercu-titre de t_secr : ses propres réponses (1/true)',
    pg_temp.ap('dir_n', 'direction', t_secr, v_dir), 'OK 1/true');
  perform pg_temp.attendre('apercu', 't_interv, x-apercu-role formateur + le titre fixe Formateur désigné : ses propres réponses (notes 0, formateur_fixe faux)',
    pg_temp.ap('t_interv', 'formateur', t_form, c_form), 'OK 0/false/false');
end $tsap2$;

-- titres_ajustables joué par un personnage : « OK <identifiants triés, séparés par des virgules> » (« OK » seul : aucun) ou l'erreur.
create or replace function pg_temp.ajustables_t(p_qui text, p_apercu text, p_titre text, p_lieu text)
returns text language sql as $tsaj1$
  select pg_temp.appeler_t(p_qui, case when p_apercu is null then null else '1' end, p_apercu, p_titre,
    format($q$select coalesce(string_agg(a.id::text, ',' order by a.id), '') from public.titres_ajustables(%s) a$q$, p_lieu));
$tsaj1$;

-- « oui » si l'identifiant figure dans une réponse « OK a,b,c », « non » sinon.
create or replace function pg_temp.dans(p_reponse text, p_id text)
returns text language sql as $tsaj2$
  select case when ',' || coalesce(substring(p_reponse from '^OK (.*)$'), '') || ',' like '%,' || p_id || ',%' then 'oui' else 'non' end;
$tsaj2$;

-- Groupe ajustables (migration 8) : mes_titres en aperçu (M10), titres_ajustables, droits des fonctions nouvelles, journal_present.
create or replace function pg_temp.groupe_ajustables()
returns void language plpgsql as $tsaj3$
declare
  v_l1t text := (select lieu_id from public.promos where id = 1)::text;
  t_interv text := pg_temp.titre_du_perso('t_interv');
  t_secr text := pg_temp.titre_du_perso('t_secr');
  t_rh text := pg_temp.titre_du_perso('t_rh');
  t_chef text := pg_temp.titre_du_perso('t_chef');
  t_dirs text := pg_temp.titre_du_perso('t_dirs');
  t_qualite text := pg_temp.titre_du_perso('t_qualite');
  t_contenus text := pg_temp.titre_du_perso('t_contenus');
  t_form text := pg_temp.calcul($q$select public.titre_fixe('promo')::text$q$);
  v_r text := pg_temp.titre_suite('R');
  v_rp text := pg_temp.titre_suite('R_promo');
  c_mes constant text := $q$select count(*)::text || coalesce(' ' || string_agg(concat_ws(' ', m.titre_id, m.nom, m.niveau, coalesce(m.lieu_id::text, 'nul'), coalesce(m.promo_ids::text, 'nul')), ' ; ' order by m.titre_id), '') from public.mes_titres() m$q$;
  v_rep text; v_attendu text; v_chef text; v_journal text; v_essai text;
begin
  -- mes_titres en aperçu : le titre simulé (M10), jamais les vrais titres.
  perform pg_temp.attendre('ajustables', 'mes_titres, fondateur en aperçu formateur + titre de t_interv : une ligne, Intervenant, promo {1}',
    pg_temp.ap('fond', 'formateur', t_interv, c_mes), format('OK 1 %s Preuve7 intervenant promo %s {1}', t_interv, v_l1t));
  perform pg_temp.attendre('ajustables', 'mes_titres, aperçu formateur + titre de t_interv : les cases rendues sont celles du titre',
    pg_temp.ap('fond', 'formateur', t_interv, 'select cases::text from public.mes_titres()'),
    'OK ' || pg_temp.calcul(format('select public._cases_effectives(%s)::text', t_interv)));
  perform pg_temp.attendre('ajustables', 'mes_titres, aperçu formateur sans en-tête de titre : une ligne, le Formateur fixe, promo {1}',
    pg_temp.ap('fond', 'formateur', null, c_mes), format('OK 1 %s Formateur promo %s {1}', t_form, v_l1t));
  perform pg_temp.attendre('ajustables', 'mes_titres, aperçu direction sans en-tête de titre : une ligne, la Direction de centre fixe, centre 1, sans promos',
    pg_temp.ap('fond', 'direction', null, c_mes), format('OK 1 %s Direction de centre centre %s nul', pg_temp.calcul($q$select public.titre_fixe('centre')::text$q$), v_l1t));
  perform pg_temp.attendre('ajustables', 'mes_titres, aperçu siège + titre de t_contenus : une ligne, sans centre ni promos',
    pg_temp.ap('fond', 'siege', t_contenus, c_mes), format('OK 1 %s Preuve7 contenus reseau nul nul', t_contenus));
  perform pg_temp.attendre('ajustables', 'mes_titres, fondateur en aperçu stagiaire : aucune ligne',
    pg_temp.ap('fond', 'stagiaire', null, c_mes), 'OK 0');
  perform pg_temp.attendre('ajustables', 'mes_titres, fondateur hors aperçu : ses vrais titres (autant que ses affectations)',
    pg_temp.appeler_t('fond', null, null, null, 'select count(*)::text from public.mes_titres()'),
    'OK ' || pg_temp.calcul($q$select count(*)::text from public.affectations a join pg_temp.perso p on lower(a.email) = p.email where p.nom = 'fond'$q$));
  perform pg_temp.attendre('ajustables', 'mes_titres, t_chef (non fondateur) avec x-apercu-role direction + titre de t_interv : ses vrais titres, inchangés',
    pg_temp.ap('t_chef', 'direction', t_interv, c_mes), pg_temp.appeler_t('t_chef', null, null, null, c_mes));
  perform pg_temp.attendre('ajustables', 'mes_titres, t_chef avec x-apercu-role stagiaire (l''aperçu stagiaire vaut pour tout compte) : aucune ligne',
    pg_temp.ap('t_chef', 'stagiaire', null, c_mes), 'OK 0');
  perform pg_temp.attendre('ajustables', 'mes_titres, t_chef hors aperçu : une ligne, son titre au centre 1',
    pg_temp.appeler_t('t_chef', null, null, null, c_mes), format('OK 1 %s Preuve8 chef de centre centre %s nul', t_chef, v_l1t));
  perform pg_temp.attendre('ajustables', 'mes_titres, sans adresse : refusé (42501)',
    pg_temp.appeler_t(null, null, null, null, 'select count(*)::text from public.mes_titres()'), 'ERREUR 42501 titres: Connexion requise.');

  -- titres_ajustables au centre 1.
  v_chef := pg_temp.ajustables_t('t_chef', null, null, v_l1t);
  perform pg_temp.attendre('ajustables', 'titres_ajustables(centre 1) par t_chef (Équipe : Modifier) : le titre de t_rh oui, R oui (non porté par lui), R_promo oui, Formateur non, le titre de t_secr non (plus que le sien), le sien non',
    concat_ws(' / ', 't_rh ' || pg_temp.dans(v_chef, t_rh), 'R ' || pg_temp.dans(v_chef, v_r), 'R_promo ' || pg_temp.dans(v_chef, v_rp),
      'Formateur ' || pg_temp.dans(v_chef, t_form), 't_secr ' || pg_temp.dans(v_chef, t_secr), 'sien ' || pg_temp.dans(v_chef, t_chef)),
    't_rh oui / R oui / R_promo oui / Formateur non / t_secr non / sien non');
  v_attendu := pg_temp.appeler_t('dir_n', null, null, null, format($q$select string_agg(v.id::text, ',' order by v.id) from public.titres_visibles(%s) v where not v.fixe$q$, v_l1t));
  v_rep := pg_temp.ajustables_t('dir_n', null, null, v_l1t);
  perform pg_temp.attendre('ajustables', 'titres_ajustables(centre 1) par dir_n (direction fixe) : tous les titres non fixes visibles au centre 1',
    v_rep, v_attendu);
  perform pg_temp.attendre('ajustables', 'titres_ajustables(centre 1) par dir_n : R et R_promo (titres du réseau) en font partie, Formateur non',
    'R ' || pg_temp.dans(v_rep, v_r) || ' / R_promo ' || pg_temp.dans(v_rep, v_rp) || ' / Formateur ' || pg_temp.dans(v_rep, t_form), 'R oui / R_promo oui / Formateur non');
  perform pg_temp.attendre('ajustables', 'titres_ajustables(centre 1) par le fondateur hors aperçu : tous les titres non fixes visibles au centre 1',
    pg_temp.ajustables_t('fond', null, null, v_l1t), v_attendu);
  perform pg_temp.attendre('ajustables', 'titres_ajustables(centre 1) par le fondateur en aperçu direction : comme dir_n',
    pg_temp.ajustables_t('fond', 'direction', null, v_l1t), v_rep);
  perform pg_temp.attendre('ajustables', 'titres_ajustables(centre 1) par le fondateur en aperçu direction + titre de t_rh (Équipe : Voir) : aucun',
    pg_temp.ajustables_t('fond', 'direction', t_rh, v_l1t), 'OK');
  -- Limite connue (_cases_appelant lit les vraies affectations, même en aperçu) : le fondateur n'en a aucune, « jamais plus que soi » le
  -- compare donc à tout sur Non ; il garde les titres de promo (jamais comparés), perd les titres de centre que t_chef ajuste.
  v_rep := pg_temp.ajustables_t('fond', 'direction', t_chef, v_l1t);
  perform pg_temp.attendre('ajustables', 'limite connue : en aperçu direction + titre de t_chef, le fondateur garde R_promo (titre de promo) mais pas le titre de t_rh ni R (comparés à ses vraies cases, toutes sur Non)',
    'R_promo ' || pg_temp.dans(v_rep, v_rp) || ' / t_rh ' || pg_temp.dans(v_rep, t_rh) || ' / R ' || pg_temp.dans(v_rep, v_r), 'R_promo oui / t_rh non / R non');
  perform pg_temp.attendre('ajustables', 'titres_ajustables(centre 1) par t_rh (Équipe : Voir) : aucun',
    pg_temp.ajustables_t('t_rh', null, null, v_l1t), 'OK');
  perform pg_temp.attendre('ajustables', 'titres_ajustables(centre 1) par t_interv (titre de promo) : refusé (42501)',
    pg_temp.ajustables_t('t_interv', null, null, v_l1t), 'ERREUR 42501 titres: Réservé à l''équipe du centre.');
  perform pg_temp.attendre('ajustables', 'titres_ajustables(centre 1) sans adresse : refusé (42501)',
    pg_temp.appeler_t(null, null, null, null, format('select count(*)::text from public.titres_ajustables(%s)', v_l1t)), 'ERREUR 42501 titres: Connexion requise.');

  -- titres_ajustables au réseau.
  perform pg_temp.attendre('ajustables', 'titres_ajustables(null) par siege (siège fixe) : tous les titres du réseau non fixes',
    pg_temp.ajustables_t('siege', null, null, 'null'),
    'OK ' || pg_temp.calcul($q$select string_agg(t.id::text, ',' order by t.id) from public.titres t where not t.fixe and t.lieu_id is null$q$));
  -- D1 tel que posé par la migration 7 (_refus_gestion, règles 4 et 5) : un titre du réseau de niveau promo ou centre est au siège fixe
  -- seul ; un titre de niveau réseau demande Directions de centre sur Modifier et des cases au plus égales à celles de l'appelant.
  v_rep := pg_temp.ajustables_t('t_dirs', null, null, 'null');
  perform pg_temp.attendre('ajustables', 'titres_ajustables(null) par t_dirs (Directions : Modifier) : les titres de niveau réseau au plus égaux aux siens, sauf le sien (D1)',
    v_rep, 'OK ' || pg_temp.calcul(format($q$select string_agg(t.id::text, ',' order by t.id) from public.titres t
      where not t.fixe and t.lieu_id is null and t.niveau = 'reseau' and t.id <> %1$s
        and public._depasse(public._cases_effectives(t.id), public._cases_effectives(%1$s)) is null$q$, t_dirs)));
  perform pg_temp.attendre('ajustables', 'titres_ajustables(null) par t_dirs : t_qualite oui (au plus égal), t_contenus non (Cours sur Modifier), le sien non, R et R_promo non (siège seul)',
    concat_ws(' / ', 't_qualite ' || pg_temp.dans(v_rep, t_qualite), 't_contenus ' || pg_temp.dans(v_rep, t_contenus), 'sien ' || pg_temp.dans(v_rep, t_dirs),
      'R ' || pg_temp.dans(v_rep, v_r), 'R_promo ' || pg_temp.dans(v_rep, v_rp)),
    't_qualite oui / t_contenus non / sien non / R non / R_promo non');
  perform pg_temp.attendre('ajustables', 'titres_ajustables(null) par t_chef (titre de centre) : refusé (42501)',
    pg_temp.ajustables_t('t_chef', null, null, 'null'), 'ERREUR 42501 titres: Réservé au réseau.');

  -- Les droits des fonctions nouvelles.
  perform pg_temp.attendre('ajustables', 'droits : apercu_titre(), _case_apercu, _apercu_fixe sans exécution pour anon ni authenticated',
    pg_temp.calcul($q$select concat_ws('/', has_function_privilege('anon', 'public.apercu_titre()', 'execute')::text, has_function_privilege('authenticated', 'public.apercu_titre()', 'execute')::text,
      has_function_privilege('authenticated', 'public._case_apercu(text, integer)', 'execute')::text, has_function_privilege('authenticated', 'public._apercu_fixe()', 'execute')::text)$q$),
    'false/false/false/false');
  perform pg_temp.attendre('ajustables', 'droits : titres_ajustables et journal_present pour authenticated seul (pas anon)',
    pg_temp.calcul($q$select concat_ws('/', has_function_privilege('authenticated', 'public.titres_ajustables(integer)', 'execute')::text, has_function_privilege('anon', 'public.titres_ajustables(integer)', 'execute')::text,
      has_function_privilege('authenticated', 'public.journal_present()', 'execute')::text, has_function_privilege('anon', 'public.journal_present()', 'execute')::text)$q$),
    'true/false/true/false');

  -- journal_present : l'état réel, puis l'état inverse posé dans une sous-transaction annulée (table créée, ou renommée).
  v_journal := pg_temp.calcul($q$select (to_regclass('public.journal_droits') is not null)::text$q$);
  perform pg_temp.attendre('ajustables', 'journal_present() par t_chef : vrai si et seulement si la table journal_droits existe (' || v_journal || ' ici)',
    pg_temp.appeler_t('t_chef', null, null, null, 'select public.journal_present()::text'), 'OK ' || v_journal);
  begin
    perform pg_temp.proprio();
    if v_journal = 'true' then
      execute 'alter table public.journal_droits rename to journal_droits_preuve9';
    else
      execute 'create table public.journal_droits (id integer)';
    end if;
    v_essai := pg_temp.appeler_t('t_chef', null, null, null, 'select public.journal_present()::text');
    raise exception 'preuve ajustables : essai annulé';
  exception when others then
    perform pg_temp.proprio();
  end;
  perform pg_temp.attendre('ajustables', 'journal_present() par t_chef, la table journal_droits ' || case when v_journal = 'true' then 'renommée' else 'posée' end || ' le temps d''un essai annulé : l''inverse',
    v_essai, 'OK ' || (not v_journal::boolean)::text);
  perform pg_temp.attendre('ajustables', 'après l''essai annulé : la table journal_droits dans son état de départ',
    pg_temp.calcul($q$select (to_regclass('public.journal_droits') is not null)::text$q$), v_journal);
end $tsaj3$;

-- Les six titres du catalogue (migration 9) : l'identifiant d'un titre par son nom, en texte (« null » s'il manque : l'appel échoue
-- alors, le contrôle sort rouge).
create or replace function pg_temp.catalogue_id(p_nom text)
returns text language sql as $tscn$
  select coalesce(pg_temp.calcul(format($q$select id::text from public.titres where cree_par = 'migration 20261115_titres_9_catalogue'
    and lieu_id is null and origine_id is null and not fixe and nom = %L$q$, p_nom)), 'null');
$tscn$;

-- Groupe catalogue (migration 9, partie A) : les six titres du réseau, mot pour mot (spec § 6.2) ; ce qu'en voit une direction fixe ;
-- un don et ce qu'il ouvre ; la garde des noms ; la garde des versions du retour. L'attendu est écrit ici, indépendamment du fichier de
-- la migration. p_m9, p_r9 : les textes de la migration 9 et de son retour (le littéral neutre quand ils ne sont pas injectés : la garde
-- correspondante n'est alors pas rejouée, une information le dit).
create or replace function pg_temp.groupe_catalogue(p_m9 text, p_r9 text)
returns void language plpgsql as $tscg$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l2 integer := (select lieu_id from public.promos where id = 2);
  e_x text := (select email from pg_temp.perso where nom = 'x');
  v_secr text := pg_temp.catalogue_id('Secrétariat');
  v_verrou_avant text := pg_temp.calcul($q$select value from public.settings where promo_id is null and key = 'titres_ouverts'$q$);
  v_quatre constant text := $q$select string_agg(nom || ':' || donnable::text, ',' order by nom collate "C") from public.titres_visibles(%s)
    where lieu_id is null and not fixe and nom in ('Responsable pédagogique', 'Secrétariat', 'Ressources humaines', 'Intervenant',
      'Contenus pédagogiques', 'Qualité')$q$;
  v_nb_stag text; v_nb_eval text;
  v_etat text; v_apres text; v_nom_l1 text; v_nom_l2 text;
begin
  -- 1. Les six titres, mot pour mot : nom, niveau, cases (jsonb comparé en texte normalisé), sans centre, non fixes, origine nulle.
  perform pg_temp.attendre('catalogue', 'six titres du réseau créés par la migration 9 : noms, niveaux et cases égaux au tableau de la spec § 6.2',
    pg_temp.calcul($q$select string_agg(concat_ws(' ', nom, niveau, cases::text), ' | ' order by nom collate "C") from public.titres
      where cree_par = 'migration 20261115_titres_9_catalogue' and lieu_id is null and origine_id is null and not fixe$q$),
    (select string_agg(concat_ws(' ', c.nom, c.niveau, c.cases::jsonb::text), ' | ' order by c.nom collate "C") from (values
      ('Responsable pédagogique', 'centre', '{"promos":"modifier","stagiaires":"modifier","emargement":"voir","notes":"voir","equipe":"voir","reglages":"non"}'),
      ('Secrétariat', 'centre', '{"promos":"voir","stagiaires":"modifier","emargement":"voir","notes":"non","equipe":"voir","reglages":"non"}'),
      ('Ressources humaines', 'centre', '{"promos":"voir","stagiaires":"non","emargement":"non","notes":"non","equipe":"voir","reglages":"non"}'),
      ('Intervenant', 'promo', '{"planning":"voir","emargement":"modifier","stagiaires":"voir","notes":"non","cours":"voir","ccp2":"non","indicateurs":"non","reglages":"non"}'),
      ('Contenus pédagogiques', 'reseau', '{"cours":"modifier","directions":"non","reglages":"non"}'),
      ('Qualité', 'reseau', '{"cours":"voir","directions":"voir","reglages":"non"}')) c(nom, niveau, cases)));
  perform pg_temp.attendre('catalogue', 'chaque titre du catalogue a une case pour chaque page de son niveau, aucune autre',
    pg_temp.calcul($q$select count(*)::text from public.titres t where t.cree_par = 'migration 20261115_titres_9_catalogue'
      and (select array_agg(p.page order by p.page collate "C") from public._pages_du_niveau(t.niveau) p)
          = (select array_agg(k order by k collate "C") from jsonb_object_keys(t.cases) k)$q$), '6');

  -- 2. dir_n (direction fixe du centre 1) voit les quatre titres de promo et de centre, pas ceux du réseau ; donnables selon le verrou.
  perform pg_temp.essai($q$delete from public.settings where promo_id is null and key = 'titres_ouverts'$q$);
  perform pg_temp.attendre('catalogue', 'titres_visibles(centre 1) par dir_n, verrou fermé : Intervenant, Responsable pédagogique, Ressources humaines, Secrétariat, aucun donnable',
    pg_temp.appeler_t('dir_n', '1', null, null, format(v_quatre, v_l1)),
    'OK Intervenant:false,Responsable pédagogique:false,Ressources humaines:false,Secrétariat:false');
  perform pg_temp.essai($q$insert into public.settings (key, value, promo_id) values ('titres_ouverts', 'oui', null)$q$);
  perform pg_temp.attendre('catalogue', 'les mêmes, verrou ouvert (en propriétaire) : les quatre donnables',
    pg_temp.appeler_t('dir_n', '1', null, null, format(v_quatre, v_l1)),
    'OK Intervenant:true,Responsable pédagogique:true,Ressources humaines:true,Secrétariat:true');

  -- 3. dir_n donne Secrétariat à x au centre 1 (verrou ouvert) : x lit les stagiaires de la promo 1, aucune évaluation.
  v_nb_stag := pg_temp.calcul('select count(*)::text from public.stagiaires where promo_id = 1');
  v_nb_eval := pg_temp.calcul('select count(*)::text from public.evaluations where promo_id = 1');
  perform pg_temp.verifier('catalogue', 'départ : x libre ; la promo 1 a des stagiaires et des évaluations (jamais un contrôle à vide)',
    pg_temp.profil_m('x') = 'aucun' and v_nb_stag::integer > 0 and v_nb_eval::integer > 0,
    concat_ws(' / ', pg_temp.profil_m('x'), v_nb_stag, v_nb_eval));
  perform pg_temp.attendre('catalogue', 'dir_n donne Secrétariat (titre du réseau) à x au centre 1 : permis',
    pg_temp.donner_t('dir_n', e_x, v_secr, v_l1::text), 'OK donne');
  perform pg_temp.attendre('catalogue', 'x (Secrétariat) lit les stagiaires de la promo 1 : toutes les fiches',
    pg_temp.appeler_t('x', '1', null, null, 'select count(*)::text from public.stagiaires where promo_id = 1'), 'OK ' || v_nb_stag);
  perform pg_temp.attendre('catalogue', 'x (Secrétariat : Notes et examens Non) ne lit aucune évaluation de la promo 1',
    pg_temp.appeler_t('x', '1', null, null, 'select count(*)::text from public.evaluations where promo_id = 1'), 'OK 0');
  perform pg_temp.essai(format('delete from public.affectations where lower(email) = %L', e_x));
  perform pg_temp.essai(format('delete from public.user_profiles where lower(email) = %L', e_x));
  perform pg_temp.essai($q$delete from public.settings where promo_id is null and key = 'titres_ouverts'$q$);
  if v_verrou_avant is not null then
    perform pg_temp.essai(format('insert into public.settings (key, value, promo_id) values (''titres_ouverts'', %L, null)', v_verrou_avant));
  end if;
  perform pg_temp.attendre('catalogue', 'ménage : x libre, le verrou titres_ouverts dans son état de départ',
    pg_temp.profil_m('x') || ' / ' || coalesce(pg_temp.calcul($q$select value from public.settings where promo_id is null and key = 'titres_ouverts'$q$), 'absent'),
    'aucun / ' || coalesce(v_verrou_avant, 'absent'));

  -- 4. La garde des noms : dans une sous-transaction toujours annulée, le catalogue retiré (comme avant la migration), un titre
  --    « Secrétariat » au centre 1 et un « secrétariat » au centre 2 posés en propriétaire : la migration 9 s'arrête avec la liste et ne
  --    crée rien.
  if p_m9 = 'select 1' then
    perform pg_temp.informer('groupe catalogue', 'garde des noms non rejouée : la migration 9 n''est pas injectée dans ce mode');
  else
    v_nom_l1 := pg_temp.calcul(format('select nom from public.lieux where id = %s', v_l1));
    v_nom_l2 := pg_temp.calcul(format('select nom from public.lieux where id = %s', v_l2));
    perform pg_temp.proprio();
    begin
      delete from public.titres where cree_par = 'migration 20261115_titres_9_catalogue';
      insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values ('Secrétariat', 'centre', v_l1, '{}', 'preuve'),
        ('secrétariat', 'centre', v_l2, '{}', 'preuve');
      begin
        execute p_m9;
        v_etat := 'passe';
      exception when others then
        v_etat := 'ERREUR ' || sqlstate || ' ' || sqlerrm;
      end;
      v_apres := (select count(*)::text from public.titres where cree_par = 'migration 20261115_titres_9_catalogue');
      raise exception 'preuve catalogue : essai annulé';
    exception when others then
      if v_etat is null then v_etat := 'ERREUR ' || sqlstate || ' ' || sqlerrm; end if;
    end;
    perform pg_temp.attendre('catalogue', 'garde : un « Secrétariat » au centre 1 et un « secrétariat » au centre 2 : la migration 9 s''arrête avec la liste (titre, centre)',
      v_etat, format('ERREUR P0001 titres_9_catalogue : des titres portent déjà un nom du catalogue : « Secrétariat » (%s), « secrétariat » (%s) ; les renommer ou les supprimer d''abord ; rien n''est changé',
        v_nom_l1, v_nom_l2));
    perform pg_temp.attendre('catalogue', 'garde : rien de créé par la migration arrêtée', v_apres, '0');
    perform pg_temp.attendre('catalogue', 'essai annulé : les six titres du catalogue sont là, aucun « Secrétariat » de centre',
      pg_temp.calcul($q$select (select count(*) from public.titres where cree_par = 'migration 20261115_titres_9_catalogue')::text || '/'
        || (select count(*) from public.titres where lower(nom) = 'secrétariat' and lieu_id is not null)::text$q$), '6/0');
  end if;

  -- 5. La garde des versions du retour : dans une sous-transaction toujours annulée, les affectations des titres non fixes retirées (garde
  --    D5) et une version de Secrétariat posée au centre 1, le retour 9 s'arrête avec la liste ; titres_visibles et le catalogue restent.
  if p_r9 = 'select 1' then
    perform pg_temp.informer('groupe catalogue', 'garde des versions du retour non rejouée : le retour 9 n''est pas injecté dans ce mode');
  else
    v_etat := null;
    perform pg_temp.proprio();
    begin
      perform pg_temp.retirer_titres_non_fixes();
      insert into public.titres (nom, niveau, lieu_id, origine_id, cases, cree_par)
        select t.nom, t.niveau, v_l1, t.id, t.cases, 'preuve' from public.titres t where t.id = v_secr::bigint;
      begin
        execute p_r9;
        v_etat := 'passe';
      exception when others then
        v_etat := 'ERREUR ' || sqlstate || ' ' || sqlerrm;
      end;
      v_apres := (select count(*)::text from public.titres where cree_par = 'migration 20261115_titres_9_catalogue') || '/'
        || (select count(*)::text from pg_proc p where p.oid = to_regprocedure('public.titres_visibles(integer)') and p.prosrc like '%siege_fixe()%');
      raise exception 'preuve catalogue : essai annulé';
    exception when others then
      if v_etat is null then v_etat := 'ERREUR ' || sqlstate || ' ' || sqlerrm; end if;
    end;
    perform pg_temp.attendre('catalogue', 'retour 9 avec une version de Secrétariat au centre 1 : arrêté avec la liste (titre, centre)',
      v_etat, format('ERREUR P0001 titres_9_catalogue_retour : des centres ont leur version d''un titre du catalogue : « Secrétariat » (%s) ; les supprimer d''abord ; rien n''est changé',
        pg_temp.calcul(format('select nom from public.lieux where id = %s', v_l1))));
    perform pg_temp.attendre('catalogue', 'retour 9 arrêté : catalogue et contrôle d''accès du siège intacts', v_apres, '6/1');
  end if;
end $tscg$;

-- La définition (et les droits) de chaque fonction du schéma public, prise juste avant la migration 9 quand elle est injectée, avec le
-- nombre de titres qui ne sont pas des personnages de preuve (nom « Preuve... ») : groupe siege_lit et contrôle du retour 9.
drop table if exists pg_temp.avant_9;
create temp table avant_9 (cle text primary key, valeur text);

create or replace function pg_temp.definitions_public()
returns table(cle text, valeur text) language sql as $tsdp$
  select p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid) || ' | ' || coalesce(p.proacl::text, ''))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind in ('f', 'p');
$tsdp$;

create or replace function pg_temp.titres_hors_preuve()
returns text language sql as $tsth$
  select count(*)::text from public.titres where nom not like 'Preuve%';
$tsth$;

create or replace function pg_temp.prendre_avant_9()
returns void language plpgsql as $tspa$
begin
  perform pg_temp.proprio();
  delete from pg_temp.avant_9;
  insert into pg_temp.avant_9 (cle, valeur) select d.cle, d.valeur from pg_temp.definitions_public() d;
  insert into pg_temp.avant_9 (cle, valeur) values ('#titres', pg_temp.titres_hors_preuve());
end $tspa$;

-- Groupe siege_lit (migration 9, partie B) : le siège fixe lit les titres d'un centre (titres_visibles), en lecture seule, avec
-- « donnable » tel que la base le juge pour lui ; tout autre compte garde la réponse d'avant ; aucune autre fonction ne change.
create or replace function pg_temp.groupe_siege_lit()
returns void language plpgsql as $tssl$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l2 integer := (select lieu_id from public.promos where id = 2);
  t_secr text := pg_temp.titre_du_perso('t_secr');
  v_c2 text;
  v_ids constant text := 'select string_agg(id::text, '','' order by id) from public.titres_visibles(%s)';
  v_dir text; v_siege text; v_fond text; v_don text; v_juge text;
  v_refus constant text := 'ERREUR 42501 titres: Réservé à l''équipe du centre.';
  v_verrou_avant text := pg_temp.calcul($q$select value from public.settings where promo_id is null and key = 'titres_ouverts'$q$);
  v_corps text;
  v_fragment constant text := 'if not coalesce(geste_centre(p_lieu_id, ''equipe.lire''), false) and not coalesce(siege_fixe(), false) then';
begin
  -- Départ : un titre propre au centre 2, une direction fixe du centre 2 seulement (posés en propriétaire), le verrou fermé.
  v_c2 := pg_temp.calcul(format($q$insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values ('Preuve9 siège c2', 'centre', %s, '{"promos":"voir"}', 'preuve') returning id::text$q$, v_l2));
  insert into pg_temp.perso (ordre, nom, email, role) values (60, 'dir_c2', 'preuve9.dir.c2@exemple.invalid', 'prof') on conflict do nothing;
  perform pg_temp.essai($q$insert into public.user_profiles (email, role, is_admin, stagiaire_id) values ('preuve9.dir.c2@exemple.invalid', 'prof', false, null)$q$);
  perform pg_temp.affecter('preuve9.dir.c2@exemple.invalid', 'direction', null, v_l2, null);
  perform pg_temp.essai($q$delete from public.settings where promo_id is null and key = 'titres_ouverts'$q$);
  perform pg_temp.verifier('siege_lit', 'départ : titre de t_secr (propre au centre 1), titre propre au centre 2, direction fixe du centre 2 posés ; centres 1 et 2 distincts',
    t_secr ~ '^[0-9]+$' and v_c2 ~ '^[0-9]+$' and v_l1 <> v_l2
      and pg_temp.calcul(format($q$select count(*)::text from public.affectations a join public.titres t on t.id = a.titre_id
            where lower(a.email) = 'preuve9.dir.c2@exemple.invalid' and a.role = 'direction' and a.lieu_id = %s and t.fixe$q$, v_l2)) = '1',
    concat_ws(' / ', t_secr, v_c2, v_l1, v_l2));

  -- Le siège fixe lit les titres du centre 1 : les mêmes lignes que la direction du centre et que le fondateur.
  v_siege := pg_temp.appeler_t('siege', null, null, null, format(v_ids, v_l1));
  v_dir := pg_temp.appeler_t('dir_n', '1', null, null, format(v_ids, v_l1));
  v_fond := pg_temp.appeler_t('fond', null, null, null, format(v_ids, v_l1));
  perform pg_temp.verifier('siege_lit', 'siege (siège fixe) lit titres_visibles(centre 1) : permis, les mêmes titres que dir_n (direction du centre) et que le fondateur',
    v_siege ~ '^OK [0-9]' and v_siege = v_dir and v_siege = v_fond, concat_ws(' ; ', v_siege, v_dir, v_fond));
  perform pg_temp.attendre('siege_lit', 'parmi eux : le titre propre au centre 1 (t_secr), les quatre titres de centre et de promo du catalogue, ni le titre du centre 2 ni ceux du réseau',
    pg_temp.appeler_t('siege', null, null, null, format($q$select concat_ws('/', count(*) filter (where id = %s and lieu_id = %s),
        count(*) filter (where nom in ('Responsable pédagogique', 'Secrétariat', 'Ressources humaines', 'Intervenant') and lieu_id is null),
        count(*) filter (where id = %s), count(*) filter (where niveau = 'reseau')) from public.titres_visibles(%s)$q$, t_secr, v_l1, v_c2, v_l1)),
    'OK 1/4/0/0');
  -- « donnable » : ce que _refus_titre dit pour le siège (jugé en propriétaire dans son contexte), titre par titre ; verrou fermé, aucun
  -- titre non fixe n'est donnable.
  v_don := pg_temp.appeler_t('siege', null, null, null, format($q$select string_agg(id || ':' || donnable::text, ',' order by id) from public.titres_visibles(%s)$q$, v_l1));
  v_juge := pg_temp.valeur_proprio((select email from pg_temp.perso where nom = 'siege'), null, null,
    format($q$select string_agg(t.id || ':' || (select (r.etat is null)::text from public._refus_titre(t.id, %s, null, 'donner') r), ',' order by t.id)
      from public.titres t where t.id = any (string_to_array(%L, ',')::bigint[])$q$, v_l1, substr(v_siege, 4)));
  perform pg_temp.attendre('siege_lit', 'donnable pour le siège = ce que la base juge pour lui (_refus_titre, donner), titre par titre', v_don, 'OK ' || v_juge);
  perform pg_temp.attendre('siege_lit', 'verrou fermé : aucun titre non fixe donnable pour le siège ; la Direction de centre (titre fixe) donnable',
    pg_temp.appeler_t('siege', null, null, null, format($q$select (count(*) filter (where donnable and not fixe))::text || '/'
      || coalesce((select donnable::text from public.titres_visibles(%1$s) where fixe and niveau = 'centre'), 'nul') from public.titres_visibles(%1$s)$q$, v_l1)),
    'OK 0/true');
  perform pg_temp.attendre('siege_lit', 'le siège ne gagne aucun geste : titres_ajustables(centre 1) lui reste refusée (inchangée)',
    pg_temp.appeler_t('siege', null, null, null, format('select count(*)::text from public.titres_ajustables(%s)', v_l1)), v_refus);

  -- Les autres comptes : la réponse d'avant.
  perform pg_temp.attendre('siege_lit', 'une direction fixe du centre 2 lit les titres du centre 1 : refusé, phrase actuelle',
    pg_temp.appeler_t('dir_c2', null, null, null, format(v_ids, v_l1)), v_refus);
  perform pg_temp.attendre('siege_lit', 'la même lit ceux de son centre (centre 2) : permis, dont le titre propre au centre 2',
    pg_temp.appeler_t('dir_c2', null, null, null, format('select count(*) filter (where id = %s)::text from public.titres_visibles(%s)', v_c2, v_l2)), 'OK 1');
  perform pg_temp.attendre('siege_lit', 'un stagiaire (stag_n) lit les titres du centre 1 : refusé, phrase actuelle',
    pg_temp.appeler_t('stag_n', '1', null, null, format(v_ids, v_l1)), v_refus);
  perform pg_temp.attendre('siege_lit', 'un titre non fixe du réseau sans case Directions (t_contenus) lit les titres du centre 1 : refusé, phrase actuelle',
    pg_temp.appeler_t('t_contenus', null, null, null, format(v_ids, v_l1)), v_refus);
  perform pg_temp.attendre('siege_lit', 'un titre non fixe du réseau avec Directions : Modifier (t_dirs) : refusé aussi (seul le siège fixe lit un centre)',
    pg_temp.appeler_t('t_dirs', null, null, null, format(v_ids, v_l1)), v_refus);
  perform pg_temp.attendre('siege_lit', 'un jeton sans adresse : refusé, connexion requise (inchangé)',
    pg_temp.appeler_t(null, null, null, null, format(v_ids, v_l1)), 'ERREUR 42501 titres: Connexion requise.');

  -- Le texte : le nouveau contrôle d'accès, une fois ; aucune autre fonction changée par la migration 9 (quand elle est injectée).
  v_corps := pg_temp.calcul($q$select replace(prosrc, E'\r', '') from pg_proc where oid = to_regprocedure('public.titres_visibles(integer)')$q$);
  perform pg_temp.attendre('siege_lit', 'titres_visibles : le contrôle d''accès du centre admet le siège fixe, une seule fois',
    ((length(v_corps) - length(replace(v_corps, v_fragment, ''))) / length(v_fragment))::text, '1');
  if exists (select 1 from pg_temp.avant_9) then
    perform pg_temp.attendre('siege_lit', 'aucune autre fonction du schéma public ne change (md5 des définitions et des droits pris avant la migration 9)',
      (select count(*)::text from pg_temp.avant_9 a full join pg_temp.definitions_public() d on d.cle = a.cle
        where coalesce(a.cle, d.cle) not in ('#titres', 'titres_visibles(integer)') and a.valeur is distinct from d.valeur), '0');
    perform pg_temp.verifier('siege_lit', 'titres_visibles a changé (md5 de la définition)',
      (select a.valeur from pg_temp.avant_9 a where a.cle = 'titres_visibles(integer)')
        is distinct from (select d.valeur from pg_temp.definitions_public() d where d.cle = 'titres_visibles(integer)'));
  else
    perform pg_temp.informer('groupe siege_lit', 'fonctions inchangées non jugeables : la migration 9 n''est pas injectée dans ce mode');
  end if;

  -- Ménage : la direction du centre 2 et son titre partent ; le verrou retrouve son état de départ.
  perform pg_temp.essai($q$delete from public.affectations where lower(email) = 'preuve9.dir.c2@exemple.invalid'$q$);
  perform pg_temp.essai($q$delete from public.user_profiles where lower(email) = 'preuve9.dir.c2@exemple.invalid'$q$);
  perform pg_temp.essai(format('delete from public.titres where id = %s', v_c2));
  perform pg_temp.essai($q$delete from public.settings where promo_id is null and key = 'titres_ouverts'$q$);
  if v_verrou_avant is not null then
    perform pg_temp.essai(format('insert into public.settings (key, value, promo_id) values (''titres_ouverts'', %L, null)', v_verrou_avant));
  end if;
end $tssl$;

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
  --    aucune règle réécrite : le md5 de pg_policies est celui d'avant elle. Juste avant la 9 injectée : les définitions des fonctions et
  --    le nombre de titres (groupe siege_lit, contrôle du retour 9).
  for i in 1 .. 4 loop
    if v_etapes[i] = 9 and v_textes[i] <> 'select 1' then
      perform pg_temp.prendre_avant_9();
    end if;
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
  if pg_temp.groupe_suite_a_jouer('d4', 7, v_mode) then
    perform pg_temp.groupe_d4();
  end if;
  if pg_temp.groupe_suite_a_jouer('m4m5', 7, v_mode) then
    perform pg_temp.groupe_m4m5();
  end if;
  if pg_temp.groupe_suite_a_jouer('m7', 7, v_mode) then
    perform pg_temp.groupe_m7();
  end if;
  if pg_temp.groupe_suite_a_jouer('apercu', 8, v_mode) then
    perform pg_temp.groupe_apercu();
  end if;
  if pg_temp.groupe_suite_a_jouer('ajustables', 8, v_mode) then
    perform pg_temp.groupe_ajustables();
  end if;
  if pg_temp.groupe_suite_a_jouer('catalogue', 9, v_mode) then
    perform pg_temp.groupe_catalogue(v_m9, v_r9);
  end if;
  if pg_temp.groupe_suite_a_jouer('siege_lit', 9, v_mode) then
    perform pg_temp.groupe_siege_lit();
  end if;
  -- d5 : le retour 7, joué dans une sous-transaction toujours annulée, refuse tant qu'un titre non fixe est porté (u porte R). Il demande
  -- le texte du retour : jugé seulement quand le retour 7 est injecté (suite --etapes 7, 7,8, 7,8,9) ; sinon une information.
  if pg_temp.groupe_suite_a_jouer('d5', 7, v_mode) then
    if v_r7 = 'select 1' then
      perform pg_temp.informer('groupe d5', 'sauté : le retour 7 n''est pas injecté dans ce mode');
    else
      perform pg_temp.groupe_d5('retour 7', v_r7, 'titres_7_correctifs_retour',
        array['public._refus_gestion(text, integer, jsonb)', 'public.ajuster_titre(bigint, integer, text, jsonb)',
              'public.donner_titre(text, bigint, integer, integer[], integer)', 'public.creer_titre(bigint, text, integer)']);
    end if;
  end if;
  -- Le même pour le retour 8 (garde D5 en tête), quand il est injecté.
  if pg_temp.groupe_suite_a_jouer('d5', 8, v_mode) then
    if v_r8 = 'select 1' then
      perform pg_temp.informer('groupe d5', 'sauté : le retour 8 n''est pas injecté dans ce mode');
    else
      perform pg_temp.groupe_d5('retour 8', v_r8, 'titres_8_apercu_retour',
        array['public.case_promo(integer, text)', 'public.case_centre(integer, text)', 'public.case_reseau(text)',
              'public.formateur_fixe(integer)', 'public.direction_fixe(integer)', 'public.siege_fixe()', 'public.mes_titres()',
              'public.apercu_titre()', 'public.titres_ajustables(integer)']);
    end if;
  end if;
  -- Le même pour le retour 9 (garde D5 en tête), quand il est injecté.
  if pg_temp.groupe_suite_a_jouer('d5', 9, v_mode) then
    if v_r9 = 'select 1' then
      perform pg_temp.informer('groupe d5', 'sauté : le retour 9 n''est pas injecté dans ce mode');
    else
      perform pg_temp.groupe_d5('retour 9', v_r9, 'titres_9_catalogue_retour', array['public.titres_visibles(integer)']);
    end if;
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
    v_etat := pg_temp.jouer('retour ' || v_n, v_retours[i]);
    perform pg_temp.etape('retour ' || v_n, v_etat, v_mode);
    -- Juste après le retour 9 : titres_visibles a la définition d'avant la migration 9 (md5), aucun titre du catalogue ne reste, et le
    -- nombre de titres (hors personnages « Preuve... ») est celui d'avant.
    if v_n = 9 and v_etat = 'jouée' and exists (select 1 from pg_temp.avant_9) then
      perform pg_temp.attendre('retour', 'après le retour 9 : titres_visibles a la définition d''avant la migration 9 (md5, droits compris)',
        (select d.valeur from pg_temp.definitions_public() d where d.cle = 'titres_visibles(integer)'),
        (select a.valeur from pg_temp.avant_9 a where a.cle = 'titres_visibles(integer)'));
      perform pg_temp.attendre('retour', 'après le retour 9 : aucun titre du catalogue ; nombre de titres (hors personnages) égal à celui d''avant la migration 9',
        pg_temp.calcul($q$select count(*)::text from public.titres where cree_par = 'migration 20261115_titres_9_catalogue'$q$) || ' / ' || pg_temp.titres_hors_preuve(),
        '0 / ' || (select a.valeur from pg_temp.avant_9 a where a.cle = '#titres'));
    end if;
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
    -- L'empreinte ne couvre pas les index : celui de la migration 7 (D4) se contrôle à part, quand le retour 7 a été joué. Les corps des
    -- fonctions, eux, sont dans l'empreinte ; les trois marqueurs de la migration 7 (un par partie) sont redits pour un échec lisible.
    if v_r7 <> 'select 1' then
      perform pg_temp.verifier('retour', 'après les retours : l''index titres_version_unique est retiré (retour 7)',
        to_regclass('public.titres_version_unique') is null);
      perform pg_temp.attendre('retour', 'après les retours : aucune phrase des parties A et C dans _refus_gestion, donner_titre, creer_titre, ajuster_titre (retour 7)',
        (select count(*)::text from pg_proc p
          where p.oid in (to_regprocedure('public._refus_gestion(text, integer, jsonb)'), to_regprocedure('public.donner_titre(text, bigint, integer, integer[], integer)'),
                          to_regprocedure('public.creer_titre(bigint, text, integer)'), to_regprocedure('public.ajuster_titre(bigint, integer, text, jsonb)'))
            and (p.prosrc like '%Réservé au siège.%' or p.prosrc like '%ne se relie qu''au titre Formateur%'
                 or p.prosrc like '%Un titre du réseau porte déjà ce nom%' or p.prosrc like '%Un centre a déjà un titre de ce nom%'
                 or p.prosrc like '%t.niveau = ''promo'' and t.fixe%')), '0');
    end if;
    if v_r8 <> 'select 1' then
      perform pg_temp.attendre('retour', 'après les retours : apercu_titre, _case_apercu, _apercu_fixe, titres_ajustables, journal_present retirées (retour 8)',
        concat_ws('/', to_regprocedure('public.apercu_titre()'), to_regprocedure('public._case_apercu(text, integer)'), to_regprocedure('public._apercu_fixe()'),
          to_regprocedure('public.titres_ajustables(integer)'), to_regprocedure('public.journal_present()')), '');
      perform pg_temp.attendre('retour', 'après les retours : aucune des six fonctions de l''aperçu ni mes_titres ne lit l''aperçu par titre (retour 8)',
        (select count(*)::text from pg_proc p
          where p.oid in (to_regprocedure('public.case_promo(integer, text)'), to_regprocedure('public.case_centre(integer, text)'),
                          to_regprocedure('public.case_reseau(text)'), to_regprocedure('public.formateur_fixe(integer)'),
                          to_regprocedure('public.direction_fixe(integer)'), to_regprocedure('public.siege_fixe()'), to_regprocedure('public.mes_titres()'))
            and (p.prosrc like '%_case_apercu%' or p.prosrc like '%_apercu_fixe%' or p.prosrc like '%apercu_titre%')), '0');
    end if;
  end if;
  perform pg_temp.informer('durée du bloc', to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0') || ' s');
  perform pg_temp.verdict_titres(v_mode, v_debut);
  raise exception 'la preuve doit finir par la levée du verdict';
end $tsprg$;
