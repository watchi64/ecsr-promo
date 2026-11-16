-- Preuve de la partie 1 du chantier « espace contact » : l'annuaire : fiches de contact rattachées à un compte, coordonnées, délégué. Écrite avec les migrations
-- 20261115_contact_1_annuaire et 20261115_contact_1b_fermeture, jouée sur une base où l'état de la production est rejoué
-- (outils/base_locale : reconstruire.sh, puis rejouer_suite.sh --titres 1,2,3,5,6 --autonomie --autonomie-version 2026-11-14).
--   structure    prérequis de l'état de départ présents (geste_promo, retirer_titre, donner_titre, contacts.lieu_id), personnages posés
--                (pg_temp.poser_contact, pg_temp.poser_annuaire), chaque migration et chaque retour injectés se jouent sans erreur.
--   entre        après la 1, avant la 1b (l'intervalle de la production entre les deux) : la lecture directe des anciens lecteurs marche
--                encore, ne montre aucune fiche avec compte et aucun champ nouveau rempli.
--   fiches       une fiche d'office par adresse de formateur ou de direction, aucune pour les autres ; elle naît avec la première
--                affectation, disparaît avec la dernière ; rattachement à profs (reprise de la ligne d'une fiche sans compte) ; copies
--                identiques fusionnées, copie modifiée à part,
--                valeurs des fiches sans compte gardées (centres des copies compris).
--   annuaire     annuaire_centre() : les fiches du centre de la promo affichée et les fiches partagées avec lui, masque d'une fiche non
--                vérifiée, champs d'édition rendus à qui écrit, titres du centre, tri.
--   ecritures    écritures directes : fiches sans compte de son centre seulement, colonnes permises, partage jugé centre par centre,
--                relais d'un des centres de la fiche, rattachement à profs (jamais la ligne d'un compte de l'équipe, une ligne du
--                planning d'un des centres de la fiche), aucune écriture pour anon.
--   depart       date de départ d'une fiche sans compte : passée, la fiche n'est plus rendue qu'à qui l'écrit.
--   ma_fiche     ma_fiche_contact(), regler_ma_fiche() (vérification au premier enregistrement, refus), ordonner_fiches().
--   coordonnees  téléphone et financement d'un stagiaire (regler_coordonnees_stagiaire, coordonnees_promo, stagiaires_prive), délégué.
--   financements liste livrée d'office (centres existants, centre créé), financements_du_centre(), regler_financements().
--   profils      les profils du personnel fermés aux stagiaires et à l'aperçu stagiaire ; l'équipe et le siège en lisent autant qu'avant.
--   fermeture    après la 1b : la lecture directe de contacts n'est plus ouverte qu'à qui écrit les fiches.
--   demo         les trois fiches fictives du centre de démonstration (20261115_contact_demo.sql), jouées seulement si elles existent.
--   retour       les retours défont tout, dans l'ordre inverse (1b, 1) : l'empreinte (règles, fonctions, droits) égale celle d'avant, et
--                les fiches sans compte redeviennent exactement celles d'avant (copies refaites, dates comprises).
-- Modes : dans la contre-épreuve, chaque groupe se joue et doit être ROUGE ; en ligne, un groupe dont la migration n'est pas appliquée
-- est sauté (ligne d'information), et les contrôles qui demandent d'avoir joué la migration ici (fusion, valeurs gardées) aussi.
-- GABARIT, à ne pas jouer tel quel : outils/assembler_repetition_roles.mjs y colle les aides communes (roles-aides.sql, titres-aides.sql,
-- contact-aides.sql), le libellé du mode, la requête d'empreinte, puis les migrations 1 et 1b et leurs retours :
--   node outils/assembler_repetition_roles.mjs contact-1 <sortie.sql>                 migrations injectées : VERT attendu
--   node outils/assembler_repetition_roles.mjs contact-1-contre-epreuve <sortie.sql>  la 1, la 1b et leurs retours neutralisés : ROUGE
--                                                                                      attendu sur les seuls contrôles de la partie 1
--   node outils/assembler_repetition_roles.mjs contact-1-en-ligne <sortie.sql>        rien d'injecté, après application réelle
-- À jouer sur la base locale : PGCLIENTENCODING=UTF8 psql -h 127.0.0.1 -p <port> -U postgres -d postgres -X -q -f <sortie.sql>
-- Le bloc do finit TOUJOURS par une levée (verdict) : migrations, personnages et lignes d'essai sont annulés, rien ne reste.

-- @@INCLURE tests/sql/roles-aides.sql@@
-- @@INCLURE tests/sql/titres-aides.sql@@
-- @@INCLURE tests/sql/contact-aides.sql@@

create or replace function pg_temp.empreinte(out regles text, out fonctions text, out droits text)
language plpgsql as $temp$
begin
  execute
-- @@INJECTER tests/sql/roles-empreinte.sql@@
  into regles, fonctions, droits;
end $temp$;

-- Les données d'essai de la partie A, posées AVANT les migrations, en propriétaire (tous les modes) : une ligne profs « Preuve7
-- formateur A » et deux comptes qui y sont rattachés (prof_a puis prof_b, formateurs de la promo 1) ; deux lignes identiques « Preuve
-- copie A » à Nîmes et à Montpellier (la migration les fusionne) ; deux lignes « Preuve copie B » dont le téléphone diffère (elles
-- restent à part). Les identifiants sont rangés dans pg_temp.annuaire_ids.
create or replace function pg_temp.poser_annuaire()
returns void language plpgsql as $ca_pa$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l2 integer := (select lieu_id from public.promos where id = 2);
  v_prof integer;
  v_id bigint;
begin
  drop table if exists pg_temp.annuaire_ids;
  create temp table annuaire_ids (nom text primary key, id bigint);
  insert into public.profs (nom, ordre) values ('Preuve7 formateur A', 990) returning id into v_prof;
  insert into annuaire_ids values ('prof', v_prof);
  insert into pg_temp.perso (ordre, nom, email, role) values
    (30, 'prof_a', 'preuve7.eq.prof.a@exemple.invalid', 'prof'),
    (31, 'prof_b', 'preuve7.eq.prof.b@exemple.invalid', 'prof');
  insert into public.user_profiles (email, role, is_admin, prof_id)
    select email, 'prof', false, v_prof from pg_temp.perso where ordre in (30, 31);
  insert into public.affectations (email, role, promo_id) select email, 'formateur', 1 from pg_temp.perso where ordre = 30;
  insert into public.affectations (email, role, promo_id) select email, 'formateur', 1 from pg_temp.perso where ordre = 31;
  insert into public.contacts (prenom, role, phone, note, category, sort_order, lieu_id)
    values ('Preuve copie A', 'Accueil', '01 99 00 00 31', 'copie identique', 'admin', 991, v_l1) returning id into v_id;
  insert into annuaire_ids values ('copie_a_n', v_id);
  insert into public.contacts (prenom, role, phone, note, category, sort_order, lieu_id)
    values ('Preuve copie A', 'Accueil', '01 99 00 00 31', 'copie identique', 'admin', 991, v_l2) returning id into v_id;
  insert into annuaire_ids values ('copie_a_m', v_id);
  insert into public.contacts (prenom, role, phone, note, category, sort_order, lieu_id)
    values ('Preuve copie B', 'Accueil', '01 99 00 00 32', 'copie modifiée', 'admin', 992, v_l1) returning id into v_id;
  insert into annuaire_ids values ('copie_b_n', v_id);
  insert into public.contacts (prenom, role, phone, note, category, sort_order, lieu_id)
    values ('Preuve copie B', 'Accueil', '01 99 00 00 33', 'copie modifiée', 'admin', 992, v_l2) returning id into v_id;
  insert into annuaire_ids values ('copie_b_m', v_id);
end $ca_pa$;

-- Identifiant d'une ligne d'essai (texte), ou « null ».
create or replace function pg_temp.id_essai(p_nom text)
returns text language plpgsql as $ca_ie$
begin
  return coalesce((select id::text from pg_temp.annuaire_ids where nom = p_nom), 'null');
end $ca_ie$;

-- Identifiant de la fiche avec compte d'un personnage (texte), « null » s'il n'en a pas, ou « incalculable (...) » si la colonne manque
-- (contre-épreuve : le texte, glissé dans une requête, la fait échouer, et le contrôle est rouge).
create or replace function pg_temp.id_fiche(p_qui text)
returns text language plpgsql as $ca_if$
begin
  return coalesce(pg_temp.calcul(format('select id::text from public.contacts where compte_email = lower(%L)',
    (select email from pg_temp.perso where nom = p_qui))), 'null');
end $ca_if$;

-- Une requête jouée par un personnage après une préparation en propriétaire, le tout annulé : la valeur que rend pg_temp.appeler, ou
-- « ERREUR <état> (préparation) ».
create or replace function pg_temp.voir_apres(p_prep text, p_qui text, p_entete text, p_sql text)
returns text language plpgsql as $ca_va$
declare v text;
begin
  begin
    perform pg_temp.proprio();
    execute p_prep;
    v := pg_temp.appeler(p_qui, p_entete, p_sql);
    raise exception using errcode = 'P0001', message = 'VU ' || v;
  exception when others then
    perform pg_temp.proprio();
    if sqlstate = 'P0001' and sqlerrm like 'VU %' then return substr(sqlerrm, 4); end if;
    return 'ERREUR ' || sqlstate || ' (préparation)';
  end;
end $ca_va$;

-- Le nombre attendu de lignes de l'annuaire du centre l, calculé en SQL direct sur les données : fiches sans compte du centre ou
-- partagées avec lui (hors départ passé, sauf p_ecrit : qui écrit voit celles de son centre d'attache), plus une fiche par adresse qui a
-- une affectation de formateur sur une promo de l ou de direction sur l.
create or replace function pg_temp.attendu_annuaire(p_l integer, p_ecrit boolean)
returns text language sql as $ca_aa$
  select pg_temp.calcul(format($ca_q$select (
      (select count(*) from public.contacts c
        where c.compte_email is null and (c.lieu_id = %1$s or %1$s = any(c.lieux_partages))
          and (c.depart_le is null or c.depart_le >= (now() at time zone 'Europe/Paris')::date or (%2$s and c.lieu_id = %1$s)))
    + (select count(*) from public.contacts c
        where c.compte_email in (select lower(a.email) from public.affectations a
                                  where (a.role = 'formateur' and a.promo_id in (select p.id from public.promos p where p.lieu_id = %1$s))
                                     or (a.role = 'direction' and a.lieu_id = %1$s))))::text$ca_q$, p_l, p_ecrit::text));
$ca_aa$;

-- Groupe entre : la migration 1 sans la 1b. Les anciens lecteurs (page Documents de l'ancienne app) lisent encore les fiches sans compte
-- de leur centre ; aucune fiche avec compte ne se lit en direct (lieu_id nul) ; aucun champ nouveau n'est rempli.
create or replace function pg_temp.groupe_entre()
returns void language plpgsql as $ca_ge$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l2 integer := (select lieu_id from public.promos where id = 2);
  v_n text;
begin
  v_n := pg_temp.calcul(format('select count(*)::text from public.contacts where compte_email is null and lieu_id = %s', v_l1));
  perform pg_temp.verifier('entre', 'lignes d''essai présentes (jamais un contrôle à vide)', v_n ~ '^[0-9]+$' and v_n::integer > 0, 'obtenu ' || coalesce(v_n, 'nul'));
  perform pg_temp.attendre('entre', 'stag_n lit en direct les fiches sans compte de Nîmes, comme avant la 1b',
    pg_temp.appeler('stag_n', '1', 'select count(*)::text from public.contacts'), 'OK ' || v_n);
  perform pg_temp.verifier('entre', 'des fiches d''office existent (sinon le contrôle suivant serait à vide)',
    pg_temp.calcul('select (count(*) > 0)::text from public.contacts where compte_email is not null') = 'true');
  perform pg_temp.attendre('entre', 'stag_n et form_n : aucune fiche avec compte en lecture directe',
    pg_temp.appeler('stag_n', '1', 'select count(*) filter (where compte_email is not null)::text from public.contacts') || ' / '
      || pg_temp.appeler('form_n', '1', 'select count(*) filter (where compte_email is not null)::text from public.contacts'), 'OK 0 / OK 0');
  perform pg_temp.attendre('entre', 'stag_n : aucun champ nouveau rempli dans ce qu''il lit en direct',
    pg_temp.appeler('stag_n', '1', 'select count(*) filter (where nom is not null or pour_quoi is not null or quand is not null or verifiee_le is not null or relais_id is not null or conge_du is not null or conge_au is not null or prof_id is not null or depart_le is not null)::text from public.contacts'),
    'OK 0');
  perform pg_temp.informer('entre : Montpellier', format('fiches sans compte lues en direct par stag_m : %s ; fiches de Nîmes partagées avec Montpellier (lues par annuaire_centre seulement) : %s',
    pg_temp.appeler('stag_m', '2', 'select count(*)::text from public.contacts'),
    pg_temp.calcul(format('select count(*)::text from public.contacts where lieu_id <> %1$s and %1$s = any(lieux_partages)', v_l2))));
end $ca_ge$;

-- Groupe fiches.
create or replace function pg_temp.groupe_fiches(p_injecte boolean, p_av_lignes text)
returns void language plpgsql as $ca_gf$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l2 integer := (select lieu_id from public.promos where id = 2);
  v_ob text; v_at text; v_n text; r record; v_res text[];
  v_titre_form text := pg_temp.calcul('select id::text from public.titres where fixe and niveau = ''promo''');
  v_titre_dir text := pg_temp.calcul('select id::text from public.titres where fixe and niveau = ''centre''');
begin
  v_ob := ''; v_at := '';
  for r in select p.nom, p.email from pg_temp.perso p
            where p.nom in ('form_n', 'form_m', 'form_s', 'dir_n', 'dir_s', 'dir_deux', 'dir_form', 'cumul', 'siege_form', 't_interv',
                            't_secr', 't_rh', 'dir_vide', 'prof_a', 'prof_b') order by p.ordre loop
    v_ob := v_ob || r.nom || '=' || coalesce(pg_temp.calcul(format('select count(*) filter (where lower(compte_email) = lower(%L))::text from public.contacts', r.email)), 'nul') || ' ';
    v_at := v_at || r.nom || '=1 ';
  end loop;
  perform pg_temp.attendre('fiches', 'une fiche et une seule par personne de l''équipe (dir_deux : direction de deux centres, une fiche)', v_ob, v_at);
  v_ob := ''; v_at := '';
  for r in select p.nom, p.email from pg_temp.perso p
            where p.nom in ('siege', 'stag_n', 'stag_m', 'stag_s', 'sans_role', 'fond', 'ancien_form', 't_contenus') order by p.ordre loop
    v_ob := v_ob || r.nom || '=' || coalesce(pg_temp.calcul(format('select count(*) filter (where lower(compte_email) = lower(%L))::text from public.contacts', r.email)), 'nul') || ' ';
    v_at := v_at || r.nom || '=0 ';
  end loop;
  perform pg_temp.attendre('fiches', 'aucune fiche pour le siège, les stagiaires, un compte sans affectation, le fondateur', v_ob, v_at);
  perform pg_temp.attendre('fiches', 'autant de fiches avec compte que d''adresses ayant une affectation de formateur ou de direction, et chacune en a une',
    pg_temp.calcul('select (select count(*) from public.contacts where compte_email is not null)::text || ''/'' || (select count(*) from public.contacts c where c.compte_email is not null and not exists (select 1 from public.affectations a where lower(a.email) = c.compte_email and a.role in (''formateur'', ''direction'')))::text'),
    pg_temp.calcul('select count(distinct lower(email))::text || ''/0'' from public.affectations where role in (''formateur'', ''direction'')'));
  -- Rattachement à profs : prof_a (premier) reprend la ligne de son compte, prof_b (même ligne) non ; aucune fiche d'office n'a une
  -- autre ligne que celle de son compte.
  perform pg_temp.attendre('fiches', 'rattachement à profs : prof_a reprend la ligne de son compte, prof_b non (une seule fiche par ligne)',
    pg_temp.calcul(format('select concat_ws(''/'', (select coalesce(prof_id::text, ''nul'') from public.contacts where compte_email = %L), (select coalesce(prof_id::text, ''nul'') from public.contacts where compte_email = %L))',
      'preuve7.eq.prof.a@exemple.invalid', 'preuve7.eq.prof.b@exemple.invalid')),
    pg_temp.id_essai('prof') || '/nul');
  perform pg_temp.attendre('fiches', 'aucune fiche d''office rattachée à une autre ligne profs que celle de son compte',
    pg_temp.calcul('select count(*)::text from public.contacts c where c.compte_email is not null and c.prof_id is not null and not exists (select 1 from public.user_profiles u where lower(u.email) = c.compte_email and u.prof_id = c.prof_id)'), '0');
  -- Une affectation nouvelle crée la fiche, avec la ligne profs donnée à l'invitation.
  v_res := pg_temp.tenter((select email from pg_temp.perso where nom = 'dir_n'), '1', null,
    $ca_q$insert into public.profs (nom, ordre) values ('Preuve7 formateur C', 991)$ca_q$, null,
    $ca_q$select public.inviter_compte('preuve7.eq.nouveau@exemple.invalid', 'formateur', null, (select id from public.profs where nom = 'Preuve7 formateur C'))$ca_q$,
    $ca_q$select count(*)::text || '/' || coalesce(max((c.prof_id = (select id from public.profs where nom = 'Preuve7 formateur C'))::text), 'nul') from public.contacts c where c.compte_email = 'preuve7.eq.nouveau@exemple.invalid'$ca_q$);
  perform pg_temp.attendre('fiches', 'inviter_compte par dir_n : la fiche du nouveau formateur naît, rattachée à sa ligne profs', v_res[2], 'OK 1 1/true');
  -- Le retrait de la dernière affectation efface la fiche ; le retrait d'une affectation sur deux la garde.
  v_res := pg_temp.tenter((select email from pg_temp.perso where nom = 'dir_n'), '1', null,
    $ca_q$insert into public.user_profiles (email, role, is_admin) values ('preuve7.eq.depart@exemple.invalid', 'prof', false);
          insert into public.affectations (email, role, promo_id) values ('preuve7.eq.depart@exemple.invalid', 'formateur', 1)$ca_q$,
    $ca_q$select count(*)::text from public.contacts where compte_email = 'preuve7.eq.depart@exemple.invalid'$ca_q$,
    format('select public.retirer_titre(%L, %s, %s)', 'preuve7.eq.depart@exemple.invalid', v_titre_form, v_l1),
    $ca_q$select count(*)::text from public.contacts where compte_email = 'preuve7.eq.depart@exemple.invalid'$ca_q$);
  perform pg_temp.attendre('fiches', 'retirer_titre de la dernière affectation par dir_n : la fiche (posée à l''affectation) s''efface',
    concat_ws(' ; ', v_res[1], v_res[2]), '1 ; OK 1 0');
  v_res := pg_temp.tenter((select email from pg_temp.perso where nom = 'siege'), null, null, null, null,
    format('select public.retirer_titre(%L, %s, %s)', (select email from pg_temp.perso where nom = 'dir_deux'), v_titre_dir, v_l2),
    format('select count(*)::text from public.contacts where compte_email = lower(%L)', (select email from pg_temp.perso where nom = 'dir_deux')));
  perform pg_temp.attendre('fiches', 'retirer_titre de la direction de Montpellier de dir_deux par le siège : sa fiche reste (direction de Nîmes)', v_res[2], 'OK 1 1');
  -- Une fiche d'office qui naît sur une ligne profs déjà prise par une fiche SANS compte la reprend (même personne) : la fiche sans compte
  -- perd son rattachement. (Prise par une fiche AVEC compte : la première la garde, cas de prof_b plus haut.)
  perform pg_temp.attendre('fiches', 'une fiche d''office qui naît sur la ligne profs d''une fiche sans compte la reprend ; la fiche sans compte la perd',
    pg_temp.ecrire_proprio(format($ca_q$insert into public.profs (nom, ordre) values ('Preuve7 formateur D', 993);
      update public.contacts set prof_id = (select id from public.profs where nom = 'Preuve7 formateur D') where id = %1$s;
      insert into public.user_profiles (email, role, is_admin, prof_id) values ('preuve7.eq.prof.d@exemple.invalid', 'prof', false, (select id from public.profs where nom = 'Preuve7 formateur D'));
      insert into public.affectations (email, role, promo_id) values ('preuve7.eq.prof.d@exemple.invalid', 'formateur', 2)$ca_q$, pg_temp.id_essai('sec_n')),
      format($ca_q$select concat_ws('/', (select coalesce((prof_id = (select id from public.profs where nom = 'Preuve7 formateur D'))::text, 'nul') from public.contacts where compte_email = 'preuve7.eq.prof.d@exemple.invalid'), (select coalesce(prof_id::text, 'nul') from public.contacts where id = %1$s))$ca_q$, pg_temp.id_essai('sec_n'))),
    'OK 1 true/nul');
  -- La fusion des copies et les valeurs gardées : seulement quand la migration se joue ici.
  if not p_injecte then
    perform pg_temp.informer('groupe fiches : fusion', 'sautée : la migration n''est pas jouée par cette preuve (mode en ligne)');
    return;
  end if;
  perform pg_temp.attendre('fiches', 'deux lignes identiques à Nîmes et à Montpellier : une seule après, celle de Nîmes, partagée avec Montpellier',
    pg_temp.calcul(format('select count(*)::text || ''/'' || coalesce(min(id)::text, ''nul'') || ''/'' || coalesce(min(lieux_partages::text), ''nul'') from public.contacts where prenom = ''Preuve copie A''')),
    format('1/%s/{%s}', pg_temp.id_essai('copie_a_n'), v_l2));
  perform pg_temp.attendre('fiches', 'une copie modifiée reste à part (deux lignes, aucune partagée)',
    pg_temp.calcul('select count(*)::text || ''/'' || count(*) filter (where lieux_partages <> ''{}'')::text from public.contacts where prenom = ''Preuve copie B'''),
    '2/0');
  perform pg_temp.attendre('fiches', 'les fiches sans compte gardent leurs valeurs (prénom, rôle, téléphone, e-mail, note, catégorie), centres des copies fusionnées compris',
    pg_temp.calcul($ca_q$select md5(coalesce(string_agg(l, E'\n' order by l collate "C"), '')) from (select concat_ws('|', c.prenom, c.role, c.phone, c.email, c.note, c.category, x.lieu) as l from public.contacts c cross join lateral unnest(array[c.lieu_id] || c.lieux_partages) as x(lieu) where c.compte_email is null) s$ca_q$),
    p_av_lignes);
end $ca_gf$;

-- Groupe annuaire : annuaire_centre() vu par chacun.
create or replace function pg_temp.groupe_annuaire(p_injecte boolean)
returns void language plpgsql as $ca_gn$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l2 integer := (select lieu_id from public.promos where id = 2);
  v_l4 integer := (select lieu_id from public.promos where id = 7);
  v_sec text := pg_temp.id_essai('sec_n');
  v_form_n text := pg_temp.id_fiche('form_n');
  v_dir_n text := pg_temp.id_fiche('dir_n');
  v_form_s text := pg_temp.id_fiche('form_s');
  v_dir_s text := pg_temp.id_fiche('dir_s');
  v_dir_form text := pg_temp.id_fiche('dir_form');
  v_prof_a text := pg_temp.id_fiche('prof_a');
  v_demo text := coalesce(pg_temp.calcul(format('select coalesce(string_agg(id::text, '','' order by id), ''0'') from public.contacts where compte_email is null and lieu_id = %s', v_l4)), '0');
  v_partagees text := coalesce(pg_temp.calcul(format('select coalesce(string_agg(id::text, '','' order by id), ''0'') from public.contacts where compte_email is null and lieu_id = %s and %s = any(lieux_partages)', v_l1, v_l2)), '0');
  v_n text;
begin
  -- La fiche de form_n, non vérifiée, porte des coordonnées (posées en propriétaire) : l'annuaire doit les masquer.
  perform pg_temp.essai(format($ca_q$update public.contacts set phone = '01 99 00 00 77', email = 'preuve7.eq.form.n.pro@exemple.invalid', pour_quoi = 'Planning', quand = 'Le matin', verifiee_le = null where id = %s$ca_q$, v_form_n));
  -- Les lignes : Nîmes.
  v_n := pg_temp.attendu_annuaire(v_l1, false);
  perform pg_temp.verifier('annuaire', 'lignes d''essai présentes à Nîmes (jamais un contrôle à vide)', v_n ~ '^[0-9]+$' and v_n::integer > 0, 'obtenu ' || coalesce(v_n, 'nul'));
  perform pg_temp.attendre('annuaire', 'stag_n (promo 1) : les fiches de Nîmes et celles partagées avec Nîmes',
    pg_temp.appeler('stag_n', '1', 'select count(*)::text from public.annuaire_centre()'), 'OK ' || v_n);
  perform pg_temp.attendre('annuaire', 'stag_n : sec_n, form_n, dir_n y sont ; aucune fiche du centre de démonstration, ni form_s, ni dir_s',
    pg_temp.appeler('stag_n', '1', format('select count(*) filter (where id in (%s, %s, %s))::text || ''/'' || count(*) filter (where id in (%s, %s, %s))::text from public.annuaire_centre()',
      v_sec, v_form_n, v_dir_n, v_demo, v_form_s, v_dir_s)), 'OK 3/0');
  -- Centre de démonstration.
  perform pg_temp.attendre('annuaire', 'stag_s (promo 7) : les fiches du centre de démonstration',
    pg_temp.appeler('stag_s', '7', 'select count(*)::text from public.annuaire_centre()'), 'OK ' || pg_temp.attendu_annuaire(v_l4, false));
  perform pg_temp.attendre('annuaire', 'stag_s : les fiches fictives du centre, form_s, dir_s ; aucune de Nîmes (sec_n, form_n, dir_n)',
    pg_temp.appeler('stag_s', '7', format('select count(*) filter (where id in (%s, %s, %s))::text || ''/'' || count(*) filter (where id in (%s, %s, %s))::text from public.annuaire_centre()',
      v_demo, v_form_s, v_dir_s, v_sec, v_form_n, v_dir_n)),
    'OK ' || (coalesce(array_length(string_to_array(v_demo, ','), 1), 0) + 2)::text || '/0');
  perform pg_temp.verifier('annuaire', 'le centre de démonstration a ses fiches fictives (jamais un contrôle à vide)', v_demo ~ '^[0-9,]+$' and v_demo <> '0', 'fiches : ' || v_demo);
  -- Montpellier : la fiche de Nîmes partagée avec Montpellier.
  perform pg_temp.verifier('annuaire', 'des fiches de Nîmes sont partagées avec Montpellier (jamais un contrôle à vide)', v_partagees ~ '^[0-9,]+$' and v_partagees <> '0', 'fiches : ' || v_partagees);
  perform pg_temp.attendre('annuaire', 'stag_m (promo 2) : les fiches de Nîmes partagées avec Montpellier, et toutes les fiches de Montpellier',
    pg_temp.appeler('stag_m', '2', format('select count(*) filter (where id in (%s))::text || ''/'' || count(*)::text from public.annuaire_centre()', v_partagees)),
    'OK ' || coalesce(array_length(string_to_array(v_partagees, ','), 1), 0)::text || '/' || pg_temp.attendu_annuaire(v_l2, false));
  if p_injecte then
    perform pg_temp.attendre('annuaire', 'stag_m voit la fiche fusionnée « Preuve copie A » (celle de Nîmes)',
      pg_temp.appeler('stag_m', '2', format('select count(*)::text from public.annuaire_centre() where id = %s', pg_temp.id_essai('copie_a_n'))), 'OK 1');
  end if;
  -- Sans promo affichée : rien.
  perform pg_temp.attendre('annuaire', 'siege sans promo, puis sous l''en-tête de la promo 1 : aucune ligne',
    pg_temp.appeler('siege', null, 'select count(*)::text from public.annuaire_centre()') || ' / '
      || pg_temp.appeler('siege', '1', 'select count(*)::text from public.annuaire_centre()'), 'OK 0 / OK 0');
  -- Le masque d'une fiche avec compte non vérifiée, puis vérifiée.
  perform pg_temp.attendre('annuaire', 'fiche de form_n non vérifiée : e-mail, téléphone, « pour quoi », « quand » nuls pour stag_n',
    pg_temp.appeler('stag_n', '1', format('select concat_ws(''/'', coalesce(email, ''nul''), coalesce(telephone, ''nul''), coalesce(pour_quoi, ''nul''), coalesce(quand, ''nul''), verifiee::text, joignable::text) from public.annuaire_centre() where id = %s', v_form_n)),
    'OK nul/nul/nul/nul/false/true');
  perform pg_temp.attendre('annuaire', 'la même, vérifiée : stag_n lit ses coordonnées',
    pg_temp.voir_apres(format('update public.contacts set verifiee_le = now() where id = %s', v_form_n), 'stag_n', '1',
      format('select concat_ws(''/'', coalesce(email, ''nul''), coalesce(telephone, ''nul''), coalesce(pour_quoi, ''nul''), coalesce(quand, ''nul''), verifiee::text) from public.annuaire_centre() where id = %s', v_form_n)),
    'OK preuve7.eq.form.n.pro@exemple.invalid/01 99 00 00 77/Planning/Le matin/true');
  -- Les champs d'édition : rendus à qui écrit la fiche, nuls pour les autres.
  perform pg_temp.attendre('annuaire', 'sec_n (sans compte, Nîmes) vue par stag_n : prénom, centres de partage, catégorie nuls, pas modifiable ; libellé et e-mail rendus',
    pg_temp.appeler('stag_n', '1', format('select concat_ws(''/'', coalesce(prenom, ''nul''), coalesce(lieux_partages::text, ''nul''), coalesce(categorie, ''nul''), ecrivable::text, avec_compte::text, libelle, email, joignable::text, nom_affiche) from public.annuaire_centre() where id = %s', v_sec)),
    'OK nul/nul/nul/false/false/Secrétariat/preuve.sec@exemple.invalid/true/Preuve Secrétariat');
  perform pg_temp.attendre('annuaire', 'sec_n vue par form_n : prénom, centres de partage, catégorie rendus, modifiable',
    pg_temp.appeler('form_n', '1', format('select concat_ws(''/'', coalesce(prenom, ''nul''), coalesce(lieux_partages::text, ''nul''), coalesce(categorie, ''nul''), ecrivable::text) from public.annuaire_centre() where id = %s', v_sec)),
    'OK Preuve Secrétariat/{}/admin/true');
  perform pg_temp.attendre('annuaire', 'fiches partagées avec Montpellier vues par form_n : centres de partage rendus ; par stag_n : aucun',
    pg_temp.appeler('form_n', '1', format('select count(*)::text from public.annuaire_centre() where lieux_partages @> array[%s]', v_l2)) || ' / '
      || pg_temp.appeler('stag_n', '1', 'select count(*) filter (where lieux_partages is not null or prenom is not null or categorie is not null or ecrivable)::text from public.annuaire_centre()'),
    'OK ' || coalesce(array_length(string_to_array(v_partagees, ','), 1), 0)::text || ' / OK 0');
  perform pg_temp.attendre('annuaire', 'form_m (Montpellier) ne modifie pas une fiche de Nîmes partagée avec Montpellier (ecrivable faux)',
    pg_temp.appeler('form_m', '2', format('select count(*) filter (where ecrivable)::text from public.annuaire_centre() where id in (%s)', v_partagees)), 'OK 0');
  perform pg_temp.attendre('annuaire', 'form_n : modifiables = les fiches sans compte de Nîmes (centre d''attache)',
    pg_temp.appeler('form_n', '1', 'select count(*) filter (where ecrivable)::text from public.annuaire_centre()'),
    'OK ' || pg_temp.calcul(format('select count(*)::text from public.contacts where compte_email is null and lieu_id = %s', v_l1)));
  -- Nom affiché, titres du centre, moi, tri.
  perform pg_temp.attendre('annuaire', 'prof_a : nom affiché = sa ligne profs, titre Formateur de la promo 1',
    pg_temp.appeler('stag_n', '1', format('select nom_affiche || '' '' || titres::text from public.annuaire_centre() where id = %s', v_prof_a)),
    'OK Preuve7 formateur A [{"nom": "Formateur", "niveau": "promo", "promos": [1]}]');
  perform pg_temp.attendre('annuaire', 'dir_form : à Nîmes, son titre de direction ; à Montpellier, son titre de formateur de la promo 2',
    pg_temp.appeler('stag_n', '1', format('select titres::text from public.annuaire_centre() where id = %s', v_dir_form)) || ' / '
      || pg_temp.appeler('stag_m', '2', format('select titres::text from public.annuaire_centre() where id = %s', v_dir_form)),
    'OK [{"nom": "Direction de centre", "niveau": "centre", "promos": []}] / OK [{"nom": "Formateur", "niveau": "promo", "promos": [2]}]');
  perform pg_temp.attendre('annuaire', 'moi : form_n se reconnaît, et lui seul',
    pg_temp.appeler('form_n', '1', format('select count(*) filter (where moi)::text || ''/'' || coalesce(max(id) filter (where moi), 0)::text from public.annuaire_centre()')),
    'OK 1/' || v_form_n);
  perform pg_temp.attendre('annuaire', 'tri : ordre, puis nom affiché (collation C)',
    pg_temp.appeler('stag_n', '1', $ca_q$select coalesce(bool_and(p_ordre is null or ordre > p_ordre or (ordre = p_ordre and nom_affiche collate "C" >= p_nom collate "C")), true)::text from (select ordre, nom_affiche, lag(ordre) over w as p_ordre, lag(nom_affiche) over w as p_nom from (select a.*, row_number() over () as n from public.annuaire_centre() a) t window w as (order by n)) s$ca_q$),
    'OK true');
end $ca_gn$;

-- Groupe ecritures : écritures directes par l'API.
create or replace function pg_temp.groupe_ecritures()
returns void language plpgsql as $ca_gc$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l2 integer := (select lieu_id from public.promos where id = 2);
  v_l4 integer := (select lieu_id from public.promos where id = 7);
  v_vide text := (select info from pg_temp.perso where nom = 'dir_vide');
  v_sec text := pg_temp.id_essai('sec_n');
  v_form_n text := pg_temp.id_fiche('form_n');
  v_form_s text := pg_temp.id_fiche('form_s');
  v_dir_n text := pg_temp.id_fiche('dir_n');
  v_part text := coalesce(pg_temp.calcul(format('select min(id)::text from public.contacts where compte_email is null and lieu_id = %s and %s = any(lieux_partages)', v_l1, v_l2)), 'null');
  v_prof text := pg_temp.id_essai('prof');
  -- Une ligne profs nouvelle, au planning de la promo 1 (une entrée d'une semaine lointaine), posée en propriétaire dans les essais.
  v_planning_n constant text := $ca_q$insert into public.profs (nom, ordre) values ('Preuve7 intervenant', 994); insert into public.planning_entries (semaine_lundi, day_index, half_day, slot, promo_id, prof_id) values ('2031-01-06', 0, 'matin', 0, 1, (select id from public.profs where nom = 'Preuve7 intervenant'))$ca_q$;
  v_planning_liste constant text := $ca_q$insert into public.profs (nom, ordre) values ('Preuve7 intervenant', 994); insert into public.planning_entries (semaine_lundi, day_index, half_day, slot, promo_id, prof_ids) values ('2031-01-06', 0, 'matin', 0, 1, array[(select id from public.profs where nom = 'Preuve7 intervenant')])$ca_q$;
  v_phrase constant text := 'ERREUR 42501 contact: Vous ne pouvez partager une fiche qu''avec un centre où vous écrivez les fiches.';
  v_r text;
  v_res text[];
  e_form_n text := (select email from pg_temp.perso where nom = 'form_n');
  e_stag_n text := (select email from pg_temp.perso where nom = 'stag_n');
begin
  v_res := pg_temp.tenter(e_form_n, '1', null, null, null,
    $ca_q$insert into public.contacts (prenom, role) values ('Preuve ajout', 'Accueil')$ca_q$,
    $ca_q$select lieu_id::text || '/' || coalesce(compte_email, 'sans compte') from public.contacts where prenom = 'Preuve ajout'$ca_q$);
  perform pg_temp.attendre('ecritures', 'form_n ajoute une fiche sans compte : centre posé d''office (Nîmes)', v_res[2], format('OK 1 %s/sans compte', v_l1));
  v_res := pg_temp.tenter(e_form_n, '1', null, null, null, format($ca_q$update public.contacts set phone = '01 99 00 00 98' where id = %s$ca_q$, v_dir_n), null);
  perform pg_temp.attendre('ecritures', 'form_n modifie la fiche avec compte de dir_n par l''API : aucune ligne', v_res[2], 'OK 0');
  v_res := pg_temp.tenter(e_form_n, '1', null, null, null, format($ca_q$delete from public.contacts where id = %s$ca_q$, v_dir_n), null);
  perform pg_temp.attendre('ecritures', 'form_n supprime la fiche avec compte de dir_n par l''API : aucune ligne', v_res[2], 'OK 0');
  v_r := concat_ws(' / ',
    (pg_temp.tenter(e_form_n, '1', null, null, null, format($ca_q$update public.contacts set compte_email = 'preuve7.eq.x@exemple.invalid' where id = %s$ca_q$, v_sec), null))[2],
    (pg_temp.tenter(e_form_n, '1', null, null, null, $ca_q$insert into public.contacts (prenom, compte_email) values ('Preuve compte', 'preuve7.eq.x@exemple.invalid')$ca_q$, null))[2],
    (pg_temp.tenter(e_form_n, '1', null, null, null, format($ca_q$update public.contacts set verifiee_le = now() where id = %s$ca_q$, v_sec), null))[2],
    (pg_temp.tenter(e_form_n, '1', null, null, null, format($ca_q$update public.contacts set lieu_id = %s where id = %s$ca_q$, v_l2, v_sec), null))[2]);
  perform pg_temp.attendre('ecritures', 'form_n écrit compte_email (modification, ajout), verifiee_le, ou change lieu_id : refusé (droit de colonne)',
    v_r, 'REFUS 42501 / REFUS 42501 / REFUS 42501 / REFUS 42501');
  perform pg_temp.attendre('ecritures', 'form_n partage une fiche de Nîmes avec le centre de démonstration : refusé, avec la phrase',
    pg_temp.appeler('form_n', '1', format('update public.contacts set lieux_partages = array[%s] where id = %s', v_l4, v_sec)), v_phrase);
  perform pg_temp.attendre('ecritures', 'form_n partage une fiche de Nîmes avec Montpellier (il n''y est pas formateur) : refusé',
    pg_temp.appeler('form_n', '1', format('update public.contacts set lieux_partages = array[%s] where id = %s', v_l2, v_sec)), v_phrase);
  perform pg_temp.attendre('ecritures', 'form_n retire Montpellier d''une fiche partagée : refusé (un centre retiré se juge comme un centre ajouté)',
    pg_temp.appeler('form_n', '1', format('update public.contacts set lieux_partages = ''{}'' where id = %s', v_part)), v_phrase);
  v_res := pg_temp.tenter((select email from pg_temp.perso where nom = 'dir_deux'), '1', null, null, null,
    format('update public.contacts set lieux_partages = array[%1$s, %1$s, %2$s] where id = %3$s', v_l2, v_l1, v_sec),
    format('select lieux_partages::text from public.contacts where id = %s', v_sec));
  perform pg_temp.attendre('ecritures', 'dir_deux (direction de Nîmes et de Montpellier) partage sec_n avec Montpellier : accepté, centres sans doublon ni centre d''attache',
    v_res[2], format('OK 1 {%s}', v_l2));
  v_res := pg_temp.tenter((select email from pg_temp.perso where nom = 'fond'), '1', null, null, null,
    format('update public.contacts set lieux_partages = array[%s] where id = %s', v_vide, v_sec), null);
  perform pg_temp.attendre('ecritures', 'le fondateur hors aperçu partage avec un centre sans promo : accepté', v_res[2], 'OK 1');
  perform pg_temp.attendre('ecritures', 'un centre de partage inconnu : refusé',
    pg_temp.appeler('fond', '1', format('update public.contacts set lieux_partages = array[-7] where id = %s', v_sec)), 'ERREUR P0001 contact: Centre inconnu.');
  v_res := pg_temp.tenter((select email from pg_temp.perso where nom = 't_interv'), '1', null, null, null,
    $ca_q$insert into public.contacts (prenom) values ('Preuve intervenant')$ca_q$, null);
  perform pg_temp.verifier('ecritures', 't_interv (Intervenant, titre non fixe) ajoute une fiche : refusé',
    v_res[2] in ('REFUS 42501', 'OK 0'), 'obtenu ' || coalesce(v_res[2], 'nul'));
  v_r := concat_ws(' / ',
    (pg_temp.tenter(e_stag_n, '1', null, null, null, $ca_q$insert into public.contacts (prenom) values ('Preuve stagiaire')$ca_q$, null))[2],
    (pg_temp.tenter(e_stag_n, '1', null, null, null, $ca_q$update public.contacts set note = 'Preuve'$ca_q$, null))[2],
    (pg_temp.tenter(e_stag_n, '1', null, null, null, $ca_q$delete from public.contacts$ca_q$, null))[2]);
  perform pg_temp.attendre('ecritures', 'stag_n n''écrit rien (ajout, modification, suppression)', v_r, 'REFUS 42501 / OK 0 / OK 0');
  v_r := concat_ws(' / ',
    (pg_temp.tenter((select email from pg_temp.perso where nom = 'form_m'), '2', null, null, null, format($ca_q$update public.contacts set note = 'Preuve' where id = %s$ca_q$, v_part), null))[2],
    (pg_temp.tenter((select email from pg_temp.perso where nom = 'form_m'), '2', null, null, null, format($ca_q$delete from public.contacts where id = %s$ca_q$, v_part), null))[2]);
  perform pg_temp.attendre('ecritures', 'form_m (Montpellier) modifie ou supprime une fiche de Nîmes partagée avec Montpellier : aucune ligne', v_r, 'OK 0 / OK 0');
  perform pg_temp.attendre('ecritures', 'form_n donne à sec_n un relais du centre de démonstration (form_s) : refusé',
    pg_temp.appeler('form_n', '1', format('update public.contacts set relais_id = %s where id = %s', v_form_s, v_sec)),
    'ERREUR P0001 contact: Le relais doit être une personne de l''équipe de votre centre.');
  v_res := pg_temp.tenter(e_form_n, '1', null, null, null, format('update public.contacts set relais_id = %s where id = %s', v_form_n, v_sec),
    format('select relais_id::text from public.contacts where id = %s', v_sec));
  perform pg_temp.attendre('ecritures', 'form_n donne à sec_n un relais de Nîmes (sa propre fiche) : accepté', v_res[2], 'OK 1 ' || v_form_n);
  -- Rattachement d'une fiche sans compte à une ligne profs : jamais celle d'un compte de l'équipe (prof_a, affecté) ; une ligne du planning
  -- d'une promo d'un des centres de la fiche (prof_id ou prof_ids d'une entrée).
  perform pg_temp.attendre('ecritures', 'form_n rattache sec_n, ou une fiche nouvelle, à la ligne profs d''un compte de l''équipe (prof_a) : refusé',
    pg_temp.appeler('form_n', '1', format('update public.contacts set prof_id = %s where id = %s', v_prof, v_sec)) || ' / '
      || pg_temp.appeler('form_n', '1', format('insert into public.contacts (prenom, prof_id) values (''Preuve rattachée'', %s)', v_prof)),
    'ERREUR 42501 contact: Ce formateur a un compte : sa fiche est celle de son compte. / ERREUR 42501 contact: Ce formateur a un compte : sa fiche est celle de son compte.');
  v_r := concat_ws(' / ',
    (pg_temp.tenter(e_form_n, '1', null, v_planning_n, null,
      format('update public.contacts set prof_id = (select id from public.profs where nom = ''Preuve7 intervenant'') where id = %s', v_sec),
      format('select (prof_id = (select id from public.profs where nom = ''Preuve7 intervenant''))::text from public.contacts where id = %s', v_sec)))[2],
    (pg_temp.tenter(e_form_n, '1', null, v_planning_liste, null,
      format('update public.contacts set prof_id = (select id from public.profs where nom = ''Preuve7 intervenant'') where id = %s', v_sec), null))[2]);
  perform pg_temp.attendre('ecritures', 'form_n rattache sec_n à une ligne du planning de Nîmes (formateur principal, puis dans la liste) : accepté',
    v_r, 'OK 1 true / OK 1');
  perform pg_temp.attendre('ecritures', 'form_n rattache sec_n à une ligne du seul planning de Montpellier : refusé ; sec_n partagée avec Montpellier : accepté',
    pg_temp.voir_apres(replace(v_planning_n, ', 1, (select', ', 2, (select'), 'form_n', '1',
      format('update public.contacts set prof_id = (select id from public.profs where nom = ''Preuve7 intervenant'') where id = %s', v_sec)) || ' / '
      || pg_temp.voir_apres(replace(v_planning_n, ', 1, (select', ', 2, (select') || format('; update public.contacts set lieux_partages = array[%s] where id = %s', v_l2, v_sec),
           'form_n', '1', format('update public.contacts set prof_id = (select id from public.profs where nom = ''Preuve7 intervenant'') where id = %s returning prof_id is not null', v_sec)),
    'ERREUR 42501 contact: Ce formateur ne figure pas au planning de ce centre. / OK true');
  -- anon : droits d'écriture retirés.
  v_r := concat_ws(' / ',
    (pg_temp.tenter(null, '1', null, null, null, $ca_q$insert into public.contacts (prenom) values ('Preuve anonyme')$ca_q$, null))[2],
    (pg_temp.tenter(null, '1', null, null, null, $ca_q$update public.contacts set note = 'Preuve'$ca_q$, null))[2],
    (pg_temp.tenter(null, '1', null, null, null, $ca_q$delete from public.contacts$ca_q$, null))[2]);
  perform pg_temp.attendre('ecritures', 'anon : ajout, modification, suppression refusés (droits retirés)', v_r, 'REFUS 42501 / REFUS 42501 / REFUS 42501');
end $ca_gc$;

-- Groupe depart : la date de départ d'une fiche sans compte.
create or replace function pg_temp.groupe_depart()
returns void language plpgsql as $ca_gd$
declare
  v_l2 integer := (select lieu_id from public.promos where id = 2);
  v_sec text := pg_temp.id_essai('sec_n');
  v_form_n text := pg_temp.id_fiche('form_n');
  v_hier constant text := ((now() at time zone 'Europe/Paris')::date - 1)::text;
  v_auj constant text := ((now() at time zone 'Europe/Paris')::date)::text;
  v_demain constant text := ((now() at time zone 'Europe/Paris')::date + 1)::text;
  v_res text[];
  v_compte constant text := 'select count(*)::text from public.annuaire_centre() where id = %s';
begin
  v_res := pg_temp.tenter((select email from pg_temp.perso where nom = 'form_n'), '1', null, null, null,
    format('update public.contacts set depart_le = %L where id = %s', v_demain, v_sec), format('select depart_le::text from public.contacts where id = %s', v_sec));
  perform pg_temp.attendre('depart', 'form_n écrit la date de départ d''une fiche sans compte de Nîmes', v_res[2], 'OK 1 ' || v_demain);
  v_res := pg_temp.tenter((select email from pg_temp.perso where nom = 'stag_n'), '1', null, null, null,
    format('update public.contacts set depart_le = %L where id = %s', v_demain, v_sec), null);
  perform pg_temp.attendre('depart', 'stag_n écrit une date de départ : aucune ligne', v_res[2], 'OK 0');
  perform pg_temp.attendre('depart', 'une fiche avec compte ne porte pas de date de départ (contrainte)',
    pg_temp.ecrire_proprio(format('update public.contacts set depart_le = %L where id = %s', v_hier, v_form_n)), 'REFUS 23514 contacts_depart_sans_compte');
  -- Départ passé (hier) : stag_n ne la voit plus ; form_n et dir_n (qui l'écrivent) la voient, datée ; form_m ne l'écrit pas (centre de
  -- partage) : il ne la voit plus.
  perform pg_temp.attendre('depart', 'départ passé : stag_n ne voit plus la fiche, form_n et dir_n la voient avec sa date, form_m (partage) ne la voit plus',
    concat_ws(' / ',
      pg_temp.voir_apres(format('update public.contacts set depart_le = %L, lieux_partages = array[%s] where id = %s', v_hier, v_l2, v_sec), 'stag_n', '1', format(v_compte, v_sec)),
      pg_temp.voir_apres(format('update public.contacts set depart_le = %L, lieux_partages = array[%s] where id = %s', v_hier, v_l2, v_sec), 'form_n', '1', format('select depart_le::text from public.annuaire_centre() where id = %s', v_sec)),
      pg_temp.voir_apres(format('update public.contacts set depart_le = %L, lieux_partages = array[%s] where id = %s', v_hier, v_l2, v_sec), 'dir_n', '1', format(v_compte, v_sec)),
      pg_temp.voir_apres(format('update public.contacts set depart_le = %L, lieux_partages = array[%s] where id = %s', v_hier, v_l2, v_sec), 'form_m', '2', format(v_compte, v_sec))),
    format('OK 0 / OK %s / OK 1 / OK 0', v_hier));
  perform pg_temp.attendre('depart', 'départ aujourd''hui ou demain : stag_n voit encore la fiche, sans la date (champ d''édition)',
    concat_ws(' / ',
      pg_temp.voir_apres(format('update public.contacts set depart_le = %L where id = %s', v_auj, v_sec), 'stag_n', '1', format('select count(*)::text || ''/'' || coalesce(max(depart_le)::text, ''nul'') from public.annuaire_centre() where id = %s', v_sec)),
      pg_temp.voir_apres(format('update public.contacts set depart_le = %L where id = %s', v_demain, v_sec), 'stag_n', '1', format('select count(*)::text || ''/'' || coalesce(max(depart_le)::text, ''nul'') from public.annuaire_centre() where id = %s', v_sec))),
    'OK 1/nul / OK 1/nul');
end $ca_gd$;

-- Groupe fermeture : la migration 1b. La lecture directe n'est plus ouverte qu'à qui écrit les fiches de la promo affichée.
create or replace function pg_temp.groupe_fermeture()
returns void language plpgsql as $ca_gm$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_n text := pg_temp.calcul(format('select count(*)::text from public.contacts where compte_email is null and lieu_id = %s', v_l1));
begin
  perform pg_temp.verifier('fermeture', 'lignes d''essai présentes (jamais un contrôle à vide)', v_n ~ '^[0-9]+$' and v_n::integer > 0, 'obtenu ' || coalesce(v_n, 'nul'));
  perform pg_temp.attendre('fermeture', 'lecture directe de contacts : stag_n 0, t_interv 0, t_secr 0, stag_m 0',
    concat_ws(' / ',
      pg_temp.appeler('stag_n', '1', 'select count(*)::text from public.contacts'),
      pg_temp.appeler('t_interv', '1', 'select count(*)::text from public.contacts'),
      pg_temp.appeler('t_secr', '1', 'select count(*)::text from public.contacts'),
      pg_temp.appeler('stag_m', '2', 'select count(*)::text from public.contacts')),
    'OK 0 / OK 0 / OK 0 / OK 0');
  perform pg_temp.attendre('fermeture', 'lecture directe de contacts : form_n et dir_n lisent les fiches sans compte de Nîmes',
    pg_temp.appeler('form_n', '1', 'select count(*)::text from public.contacts') || ' / ' || pg_temp.appeler('dir_n', '1', 'select count(*)::text from public.contacts'),
    format('OK %1$s / OK %1$s', v_n));
  perform pg_temp.attendre('fermeture', 'le fondateur en aperçu stagiaire ne lit plus contacts en direct',
    pg_temp.valeur((select email from pg_temp.perso where nom = 'fond'), '1', 'stagiaire', 'select count(*)::text from public.contacts'), '0');
end $ca_gm$;

-- ===== Partie B (tâche 3) =====

-- Deux listes JSON mises bout à bout, en texte ; « incalculable (...) » si l'une ne se lit pas (contre-épreuve : la valeur, glissée dans
-- une requête, la fait échouer et le contrôle est rouge, sans arrêter la preuve).
create or replace function pg_temp.json_plus(p_a text, p_b text)
returns text language sql as $ca_jp$
  select pg_temp.calcul(format('select (%L::jsonb || %L::jsonb)::text', p_a, p_b));
$ca_jp$;

-- Groupe ma_fiche : « Ma fiche de contact » (lecture, enregistrement, refus) et l'ordre des fiches du centre. Les enregistrements
-- acceptés restent faits (fiches avec compte : le retour les supprime) ; l'ordre se tente dans une sous-transaction annulée (il touche
-- des fiches sans compte, que le groupe retour compare à celles d'avant).
create or replace function pg_temp.groupe_ma_fiche()
returns void language plpgsql as $ca_gmf$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_form_n text := pg_temp.id_fiche('form_n');
  v_dir_n text := pg_temp.id_fiche('dir_n');
  v_form_s text := pg_temp.id_fiche('form_s');
  v_form_m text := pg_temp.id_fiche('form_m');
  v_sec text := pg_temp.id_essai('sec_n');
  e_form_n text := (select email from pg_temp.perso where nom = 'form_n');
  e_stag_n text := (select email from pg_temp.perso where nom = 'stag_n');
  c_regler constant text := 'select concat_ws(''/'', %s) from (select public.regler_ma_fiche(%L::jsonb) as r) x';
  c_relais constant text := 'ERREUR P0001 contact: Le relais doit être une personne de l''équipe de votre centre.';
  c_conge constant text := 'ERREUR P0001 contact: Les dates du congé ne se suivent pas.';
  v_ids text;
  v_res text[];
begin
  perform pg_temp.verifier('ma_fiche', 'les fiches de form_n, dir_n, form_s, form_m existent (jamais un contrôle à vide)',
    concat_ws(',', v_form_n, v_dir_n, v_form_s, v_form_m) ~ '^[0-9]+,[0-9]+,[0-9]+,[0-9]+$', concat_ws(',', v_form_n, v_dir_n, v_form_s, v_form_m));
  -- Lecture.
  perform pg_temp.attendre('ma_fiche', 'form_n lit sa fiche : non vérifiée, adresse de son compte, un centre (Nîmes)',
    pg_temp.appeler('form_n', '1', $ca_q$select concat_ws('/', coalesce(r->'fiche'->>'verifiee', 'nul'), coalesce(r->>'email_compte', 'nul'), jsonb_array_length(r->'centres'), coalesce(r->'centres'->0->>'id', 'nul')) from (select public.ma_fiche_contact() as r) x$ca_q$),
    format('OK false/%s/1/%s', e_form_n, v_l1));
  perform pg_temp.attendre('ma_fiche', 'relais possibles de form_n : dir_n et sec_n y sont, ni sa fiche ni celle de form_s (centre de démonstration) ni celle de form_m (Montpellier)',
    pg_temp.appeler('form_n', '1', format($ca_q$select count(*) filter (where (x->>'id')::bigint in (%s, %s))::text || '/' || count(*) filter (where (x->>'id')::bigint in (%s, %s, %s))::text from jsonb_array_elements(public.ma_fiche_contact()->'relais_possibles') x$ca_q$,
      v_dir_n, v_sec, v_form_n, v_form_s, v_form_m)),
    'OK 2/0');
  perform pg_temp.attendre('ma_fiche', 'stag_n et siege : aucune fiche, aucun centre, aucun relais ; l''adresse de leur compte',
    pg_temp.appeler('stag_n', '1', $ca_q$select concat_ws('/', jsonb_typeof(r->'fiche'), r->>'email_compte', jsonb_array_length(r->'centres'), jsonb_array_length(r->'relais_possibles')) from (select public.ma_fiche_contact() as r) x$ca_q$) || ' / '
      || pg_temp.appeler('siege', null, $ca_q$select concat_ws('/', jsonb_typeof(r->'fiche'), jsonb_array_length(r->'centres')) from (select public.ma_fiche_contact() as r) x$ca_q$),
    format('OK null/%s/0/0 / OK null/0', e_stag_n));
  perform pg_temp.attendre('ma_fiche', 'peut_ecrire (geste des fiches sans compte) : form_n (formateur fixe) et dir_n (direction) vrai ; stag_n, t_secr, t_interv (titres non fixes) faux',
    concat_ws(' / ',
      pg_temp.appeler('form_n', '1', $ca_q$select (public.ma_fiche_contact()->>'peut_ecrire')$ca_q$),
      pg_temp.appeler('dir_n', '1', $ca_q$select (public.ma_fiche_contact()->>'peut_ecrire')$ca_q$),
      pg_temp.appeler('stag_n', '1', $ca_q$select (public.ma_fiche_contact()->>'peut_ecrire')$ca_q$),
      pg_temp.appeler('t_secr', '1', $ca_q$select (public.ma_fiche_contact()->>'peut_ecrire')$ca_q$),
      pg_temp.appeler('t_interv', '1', $ca_q$select (public.ma_fiche_contact()->>'peut_ecrire')$ca_q$)),
    'OK true / OK true / OK false / OK false / OK false');
  perform pg_temp.attendre('ma_fiche', 'form_n en aperçu stagiaire : aucune fiche (un aperçu ne fait que retirer des droits)',
    pg_temp.valeur(e_form_n, '1', 'stagiaire', $ca_q$select jsonb_typeof(public.ma_fiche_contact()->'fiche')$ca_q$), 'null');
  -- Enregistrement : vérifiée, adresse en minuscules sans espaces de bord, une clé absente ne change rien (« quand »).
  perform pg_temp.attendre('ma_fiche', 'form_n enregistre e-mail, téléphone, « pour quoi » : vérifiée, « quand » inchangé (clé absente)',
    pg_temp.appeler('form_n', '1', format(c_regler, $ca_q$r->'fiche'->>'verifiee', r->'fiche'->>'email', r->'fiche'->>'telephone', r->'fiche'->>'pour_quoi', coalesce(r->'fiche'->>'quand', 'nul')$ca_q$,
      '{"email": " Preuve7.Eq.Form.N.Pro2@exemple.invalid ", "telephone": "04 99 00 00 12", "pour_quoi": "Planning et absences"}')),
    'OK true/preuve7.eq.form.n.pro2@exemple.invalid/04 99 00 00 12/Planning et absences/Le matin');
  perform pg_temp.attendre('ma_fiche', 'stag_n voit alors l''e-mail, le téléphone et « pour quoi » de form_n dans l''annuaire',
    pg_temp.appeler('stag_n', '1', format('select concat_ws(''/'', email, telephone, pour_quoi, verifiee::text) from public.annuaire_centre() where id = %s', v_form_n)),
    'OK preuve7.eq.form.n.pro2@exemple.invalid/04 99 00 00 12/Planning et absences/true');
  perform pg_temp.attendre('ma_fiche', 'une clé à null efface (« quand »), le reste ne bouge pas',
    pg_temp.appeler('form_n', '1', format(c_regler, $ca_q$coalesce(r->'fiche'->>'quand', 'nul'), r->'fiche'->>'pour_quoi'$ca_q$, '{"quand": null}')),
    'OK nul/Planning et absences');
  perform pg_temp.attendre('ma_fiche', 'prénom et nom écrits sans ligne profs rattachée : form_n s''affiche « Preuve7 Nom »',
    pg_temp.appeler('form_n', '1', format(c_regler, $ca_q$r->'fiche'->>'prenom'$ca_q$, '{"prenom": "Preuve7", "nom": "Nom"}')) || ' / '
      || pg_temp.appeler('stag_n', '1', format('select nom_affiche from public.annuaire_centre() where id = %s', v_form_n)),
    'OK Preuve7 / OK Preuve7 Nom');
  perform pg_temp.attendre('ma_fiche', 'prénom et nom ignorés quand une ligne profs est rattachée (prof_a : son nom vient du planning)',
    pg_temp.appeler('prof_a', '1', format(c_regler, $ca_q$coalesce(r->'fiche'->>'prenom', 'nul'), coalesce(r->'fiche'->>'nom', 'nul'), r->'fiche'->>'nom_planning', r->'fiche'->>'verifiee'$ca_q$,
      '{"prenom": "Autre", "nom": "Nom"}')),
    'OK nul/nul/Preuve7 formateur A/true');
  perform pg_temp.attendre('ma_fiche', 'un enregistrement sans aucun champ vaut vérification (dir_n : faux, puis vrai)',
    pg_temp.appeler('dir_n', '1', $ca_q$select public.ma_fiche_contact()->'fiche'->>'verifiee'$ca_q$) || ' / '
      || pg_temp.appeler('dir_n', '1', $ca_q$select public.regler_ma_fiche('{}')->'fiche'->>'verifiee'$ca_q$),
    'OK false / OK true');
  -- Refus.
  perform pg_temp.attendre('ma_fiche', '« pour quoi » de 81 caractères (80 passent)',
    pg_temp.appeler('form_n', '1', format('select public.regler_ma_fiche(%L)->''fiche''->>''verifiee''', jsonb_build_object('pour_quoi', repeat('x', 81)))) || ' / '
      || pg_temp.appeler('form_n', '1', format('select char_length(public.regler_ma_fiche(%L)->''fiche''->>''pour_quoi'')', jsonb_build_object('pour_quoi', repeat('x', 80)))),
    'ERREUR P0001 contact: Ce texte est trop long (80 caractères au plus). / OK 80');
  perform pg_temp.attendre('ma_fiche', 'adresse e-mail invalide ; téléphone invalide',
    pg_temp.appeler('form_n', '1', $ca_q$select public.regler_ma_fiche('{"email": "preuve sans arobase"}')::text$ca_q$) || ' / '
      || pg_temp.appeler('form_n', '1', $ca_q$select public.regler_ma_fiche('{"telephone": "appeler le matin"}')::text$ca_q$),
    'ERREUR P0001 contact: Adresse e-mail invalide. / ERREUR P0001 contact: Numéro de téléphone invalide.');
  perform pg_temp.attendre('ma_fiche', 'relais : form_s (centre de démonstration), form_m (Montpellier), sa propre fiche, une fiche inexistante : refusés',
    concat_ws(' / ',
      pg_temp.appeler('form_n', '1', format('select public.regler_ma_fiche(''{"relais_id": %s}'')::text', v_form_s)),
      pg_temp.appeler('form_n', '1', format('select public.regler_ma_fiche(''{"relais_id": %s}'')::text', v_form_m)),
      pg_temp.appeler('form_n', '1', format('select public.regler_ma_fiche(''{"relais_id": %s}'')::text', v_form_n)),
      pg_temp.appeler('form_n', '1', $ca_q$select public.regler_ma_fiche('{"relais_id": -4}')::text$ca_q$)),
    concat_ws(' / ', c_relais, c_relais, c_relais, c_relais));
  perform pg_temp.attendre('ma_fiche', 'relais vers dir_n (Nîmes) : accepté',
    pg_temp.appeler('form_n', '1', format(c_regler, $ca_q$r->'fiche'->>'relais_id'$ca_q$, format('{"relais_id": %s}', v_dir_n))),
    'OK ' || v_dir_n);
  perform pg_temp.attendre('ma_fiche', 'congé : « au » avant « du », une seule date, une date illisible : refusés ; deux dates qui se suivent : accepté',
    concat_ws(' / ',
      pg_temp.appeler('form_n', '1', $ca_q$select public.regler_ma_fiche('{"conge_du": "2031-01-10", "conge_au": "2031-01-06"}')::text$ca_q$),
      pg_temp.appeler('form_n', '1', $ca_q$select public.regler_ma_fiche('{"conge_du": "2031-01-10"}')::text$ca_q$),
      pg_temp.appeler('form_n', '1', $ca_q$select public.regler_ma_fiche('{"conge_du": "lundi", "conge_au": "2031-01-10"}')::text$ca_q$),
      pg_temp.appeler('form_n', '1', format(c_regler, $ca_q$r->'fiche'->>'conge_du', r->'fiche'->>'conge_au'$ca_q$, '{"conge_du": "2031-01-06", "conge_au": "2031-01-10"}'))),
    concat_ws(' / ', c_conge, c_conge, c_conge, 'OK 2031-01-06/2031-01-10'));
  perform pg_temp.attendre('ma_fiche', 'champ inconnu : refusé, et nommé',
    pg_temp.appeler('form_n', '1', $ca_q$select public.regler_ma_fiche('{"compte_email": "preuve7.eq.x@exemple.invalid"}')::text$ca_q$),
    'ERREUR P0001 contact: Champ inconnu « compte_email ».');
  perform pg_temp.attendre('ma_fiche', 'stag_n, siege, form_n en aperçu stagiaire : pas de fiche (42501) ; anon : aucun droit d''exécution',
    concat_ws(' / ',
      pg_temp.appeler('stag_n', '1', $ca_q$select public.regler_ma_fiche('{}')::text$ca_q$),
      pg_temp.appeler('siege', null, $ca_q$select public.regler_ma_fiche('{}')::text$ca_q$),
      pg_temp.valeur(e_form_n, '1', 'stagiaire', $ca_q$select public.regler_ma_fiche('{}')::text$ca_q$),
      pg_temp.valeur(null, '1', null, $ca_q$select public.ma_fiche_contact()::text$ca_q$)),
    'ERREUR 42501 contact: Vous n''avez pas de fiche de contact. / ERREUR 42501 contact: Vous n''avez pas de fiche de contact. / ERREUR 42501 / ERREUR 42501');
  -- L'ordre des fiches du centre affiché.
  v_ids := substr(pg_temp.appeler('form_n', '1', 'select string_agg(id::text, '','' order by ordre desc, id desc) from public.annuaire_centre()'), 4);
  perform pg_temp.verifier('ma_fiche', 'fiches de Nîmes lues pour l''ordre (jamais un contrôle à vide)', v_ids ~ '^[0-9]+(,[0-9]+)+$', 'obtenu ' || coalesce(v_ids, 'nul'));
  perform pg_temp.attendre('ma_fiche', 'form_n ordonne les fiches de Nîmes (ordre inversé) : OK n, rang k = 10 k',
    pg_temp.voir_apres('select 1', 'form_n', '1', format('select public.ordonner_fiches(''{%s}'')::text', v_ids)) || ' / '
      || (pg_temp.tenter(e_form_n, '1', null, null, null, format('select public.ordonner_fiches(''{%s}'')', v_ids),
            format('select bool_and(c.sort_order = 10 * u.o)::text from unnest(''{%s}''::bigint[]) with ordinality u(id, o) join public.contacts c on c.id = u.id', v_ids)))[2],
    format('OK %s / OK 1 true', array_length(string_to_array(v_ids, ','), 1)));
  perform pg_temp.attendre('ma_fiche', 'form_n ordonne avec une fiche de Montpellier (form_m) : refusé ; stag_n et t_interv : refusés',
    concat_ws(' / ',
      pg_temp.appeler('form_n', '1', format('select public.ordonner_fiches(array[%s, %s])::text', v_form_n, v_form_m)),
      pg_temp.appeler('stag_n', '1', format('select public.ordonner_fiches(array[%s])::text', v_form_n)),
      pg_temp.appeler('t_interv', '1', format('select public.ordonner_fiches(array[%s])::text', v_form_n))),
    'ERREUR 42501 contact: Une fiche n''est pas de ce centre. / ERREUR 42501 contact: Réservé à qui écrit les fiches de ce centre. / ERREUR 42501 contact: Réservé à qui écrit les fiches de ce centre.');
end $ca_gmf$;

-- Groupe coordonnees : téléphone et financement d'un stagiaire (stagiaires_prive), coordonnees_promo(), délégué.
create or replace function pg_temp.groupe_coordonnees()
returns void language plpgsql as $ca_gco$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l2 integer := (select lieu_id from public.promos where id = 2);
  v_stag_n text := pg_temp.calcul(format('select stagiaire_id::text from public.user_profiles where email = %L', (select email from pg_temp.perso where nom = 'stag_n')));
  v_stag_m text := pg_temp.calcul(format('select stagiaire_id::text from public.user_profiles where email = %L', (select email from pg_temp.perso where nom = 'stag_m')));
  v_cumul text := pg_temp.calcul(format('select stagiaire_id::text from public.user_profiles where email = %L', (select email from pg_temp.perso where nom = 'cumul')));
  v_cpf_n text := pg_temp.calcul(format('select id::text from public.contact_financements where lieu_id = %s and libelle = ''CPF''', v_l1));
  v_region_n text := pg_temp.calcul(format('select id::text from public.contact_financements where lieu_id = %s and libelle = ''Région''', v_l1));
  v_cpf_m text := pg_temp.calcul(format('select id::text from public.contact_financements where lieu_id = %s and libelle = ''CPF''', v_l2));
  v_n1 text := pg_temp.calcul('select count(*)::text from public.stagiaires where promo_id = 1');
  e_form_n text := (select email from pg_temp.perso where nom = 'form_n');
  c_tel constant text := 'select public.regler_coordonnees_stagiaire(%s, %L::jsonb)';
  c_equipe constant text := 'ERREUR 42501 contact: Réservé à l''équipe.';
  c_inconnu constant text := 'ERREUR P0001 contact: Financement inconnu dans ce centre.';
  v_r text;
  v_res text[];
begin
  perform pg_temp.verifier('coordonnees', 'fiches de stag_n, stag_m, cumul, financements CPF et Région de Nîmes, CPF de Montpellier ; plusieurs fiches en promo 1 (jamais un contrôle à vide)',
    concat_ws(',', v_stag_n, v_stag_m, v_cumul, v_cpf_n, v_region_n, v_cpf_m) ~ '^[0-9]+(,[0-9]+){5}$' and v_n1 ~ '^[0-9]+$' and v_n1::integer > 2,
    concat_ws(',', v_stag_n, v_stag_m, v_cumul, v_cpf_n, v_region_n, v_cpf_m, v_n1));
  -- Téléphone.
  perform pg_temp.attendre('coordonnees', 'stag_n règle son téléphone : OK, écrit dans stagiaires_prive',
    pg_temp.appeler('stag_n', '1', format(c_tel, v_stag_n, '{"telephone": " 06 99 00 00 01 "}')) || ' '
      || pg_temp.calcul(format('select telephone from public.stagiaires_prive where stagiaire_id = %s', v_stag_n)),
    'OK 06 99 00 00 01');
  perform pg_temp.attendre('coordonnees', 'stag_n règle son financement : refusé',
    pg_temp.appeler('stag_n', '1', format(c_tel, v_stag_n, format('{"financement_id": %s}', v_cpf_n))), c_equipe);
  perform pg_temp.attendre('coordonnees', 'stag_n règle le téléphone de stag_m (autre promo) : introuvable ; celui de cumul (sa promo) : réservé à l''équipe',
    pg_temp.appeler('stag_n', '1', format(c_tel, v_stag_m, '{"telephone": "06 99 00 00 03"}')) || ' / '
      || pg_temp.appeler('stag_n', '1', format(c_tel, v_cumul, '{"telephone": "06 99 00 00 03"}')),
    'ERREUR P0001 contact: Stagiaire introuvable dans cette promo. / ' || c_equipe);
  perform pg_temp.attendre('coordonnees', 'téléphone illisible, champ inconnu : refusés',
    pg_temp.appeler('stag_n', '1', format(c_tel, v_stag_n, '{"telephone": "le matin"}')) || ' / '
      || pg_temp.appeler('stag_n', '1', format(c_tel, v_stag_n, '{"email": "preuve7.eq.x@exemple.invalid"}')),
    'ERREUR P0001 contact: Numéro de téléphone invalide. / ERREUR P0001 contact: Champ inconnu « email ».');
  perform pg_temp.attendre('coordonnees', 'form_n règle le téléphone de cumul (promo 1) : OK',
    pg_temp.appeler('form_n', '1', format(c_tel, v_cumul, '{"telephone": "06 99 00 00 02"}')), 'OK');
  -- Lectures.
  perform pg_temp.attendre('coordonnees', 'coordonnees_promo() : 1 ligne à stag_n (la sienne, avec son téléphone)',
    pg_temp.appeler('stag_n', '1', 'select count(*)::text || ''/'' || coalesce(max(stagiaire_id)::text, ''nul'') || ''/'' || coalesce(max(telephone), ''nul'') from public.coordonnees_promo()'),
    format('OK 1/%s/06 99 00 00 01', v_stag_n));
  perform pg_temp.attendre('coordonnees', 'coordonnees_promo() : toutes les fiches de la promo à form_n, t_secr (Stagiaires : Modifier), t_interv (Stagiaires : Voir) ; 0 à t_rh (Stagiaires : Non) et au siège',
    concat_ws(' / ',
      pg_temp.appeler('form_n', '1', 'select count(*)::text from public.coordonnees_promo()'),
      pg_temp.appeler('t_secr', '1', 'select count(*)::text from public.coordonnees_promo()'),
      pg_temp.appeler('t_interv', '1', 'select count(*)::text from public.coordonnees_promo()'),
      pg_temp.appeler('t_rh', '1', 'select count(*)::text from public.coordonnees_promo()'),
      pg_temp.appeler('siege', null, 'select count(*)::text from public.coordonnees_promo()')),
    format('OK %1$s / OK %1$s / OK %1$s / OK 0 / OK 0', v_n1));
  perform pg_temp.attendre('coordonnees', 'form_n lit l''e-mail du compte de stag_n et le téléphone de cumul',
    pg_temp.appeler('form_n', '1', format('select string_agg(coalesce(email, ''nul'') || '' '' || coalesce(telephone, ''nul''), '' / '' order by stagiaire_id) from public.coordonnees_promo() where stagiaire_id in (%s, %s)', v_stag_n, v_cumul)),
    'OK ' || (select string_agg(x, ' / ' order by lpad(k, 30, '0')) from (values (v_stag_n, (select email from pg_temp.perso where nom = 'stag_n') || ' 06 99 00 00 01'),
                                                                               (v_cumul, (select email from pg_temp.perso where nom = 'cumul') || ' 06 99 00 00 02')) v(k, x)));
  perform pg_temp.verifier('coordonnees', 'stagiaires_prive : au moins deux lignes de la promo 1 (jamais un contrôle à vide)',
    pg_temp.calcul('select (count(*) >= 2)::text from public.stagiaires_prive sp join public.stagiaires s on s.id = sp.stagiaire_id where s.promo_id = 1') = 'true');
  perform pg_temp.attendre('coordonnees', 'select telephone from stagiaires_prive par stag_n : sa ligne seule',
    pg_temp.appeler('stag_n', '1', 'select count(*)::text || ''/'' || coalesce(max(telephone), ''nul'') from public.stagiaires_prive'),
    'OK 1/06 99 00 00 01');
  -- Financement.
  perform pg_temp.attendre('coordonnees', 't_secr (Stagiaires : Modifier) règle un financement de Nîmes : OK, stag_n le voit',
    pg_temp.appeler('t_secr', '1', format(c_tel, v_stag_n, format('{"financement_id": %s}', v_cpf_n))) || ' / '
      || pg_temp.appeler('stag_n', '1', 'select financement_id::text || '' '' || financement from public.coordonnees_promo()'),
    format('OK / OK %s CPF', v_cpf_n));
  perform pg_temp.attendre('coordonnees', 'un financement de Montpellier, un financement retiré, un identifiant illisible : refusés',
    concat_ws(' / ',
      pg_temp.appeler('t_secr', '1', format(c_tel, v_stag_n, format('{"financement_id": %s}', v_cpf_m))),
      pg_temp.voir_apres(format('update public.contact_financements set retire = true where id = %s', v_region_n), 't_secr', '1',
        format(c_tel, v_stag_n, format('{"financement_id": %s}', v_region_n))),
      pg_temp.appeler('t_secr', '1', format(c_tel, v_stag_n, '{"financement_id": "CPF"}'))),
    concat_ws(' / ', c_inconnu, c_inconnu, c_inconnu));
  perform pg_temp.attendre('coordonnees', 'le financement déjà porté, retiré depuis, se garde ; null l''efface',
    pg_temp.voir_apres(format('update public.contact_financements set retire = true where id = %s', v_cpf_n), 't_secr', '1',
        format(c_tel, v_stag_n, format('{"financement_id": %s}', v_cpf_n))) || ' / '
      || (pg_temp.tenter((select email from pg_temp.perso where nom = 't_secr'), '1', null, null, null, format(c_tel, v_stag_n, '{"financement_id": null}'),
            format('select coalesce(financement_id::text, ''nul'') || ''/'' || coalesce(telephone, ''nul'') from public.stagiaires_prive where stagiaire_id = %s', v_stag_n)))[2],
    'OK / OK 1 nul/06 99 00 00 01');
  perform pg_temp.attendre('coordonnees', 't_interv (Stagiaires : Voir) et t_rh règlent un financement ou un téléphone : refusés',
    concat_ws(' / ',
      pg_temp.appeler('t_interv', '1', format(c_tel, v_stag_n, format('{"financement_id": %s}', v_cpf_n))),
      pg_temp.appeler('t_interv', '1', format(c_tel, v_stag_n, '{"telephone": "06 99 00 00 04"}')),
      pg_temp.appeler('t_rh', '1', format(c_tel, v_stag_n, '{"telephone": "06 99 00 00 04"}'))),
    concat_ws(' / ', c_equipe, c_equipe, c_equipe));
  -- Délégué.
  v_r := pg_temp.appeler('form_n', '1', format('update public.stagiaires set delegue = ''titulaire'' where id in (%s, %s)', v_stag_n, v_cumul));
  perform pg_temp.verifier('coordonnees', 'deux titulaires dans la promo 1 : ERREUR 23505', v_r like 'ERREUR 23505 %', 'obtenu ' || coalesce(v_r, 'nul'));
  v_res := pg_temp.tenter(e_form_n, '1', null, null, null,
    format('update public.stagiaires set delegue = case when id = %1$s then ''titulaire'' else ''suppleant'' end where id in (%1$s, %2$s)', v_stag_n, v_cumul),
    'select string_agg(delegue, '','' order by delegue) from public.stagiaires where promo_id = 1 and delegue is not null');
  perform pg_temp.attendre('coordonnees', 'form_n pose un titulaire et un suppléant dans la promo 1 : OK', v_res[2], 'OK 2 suppleant,titulaire');
  perform pg_temp.attendre('coordonnees', 'une autre valeur que titulaire ou suppléant : refusée (contrainte)',
    (pg_temp.tenter(e_form_n, '1', null, null, null, format('update public.stagiaires set delegue = ''chef'' where id = %s', v_stag_n), null))[2],
    'REFUS 23514 stagiaires_delegue_valeur');
  perform pg_temp.attendre('coordonnees', 'stag_n écrit delegue : OK 0 ; t_secr (Stagiaires : Modifier) : OK 1 ; t_rh : OK 0',
    concat_ws(' / ',
      (pg_temp.tenter((select email from pg_temp.perso where nom = 'stag_n'), '1', null, null, null, format('update public.stagiaires set delegue = ''titulaire'' where id = %s', v_stag_n), null))[2],
      (pg_temp.tenter((select email from pg_temp.perso where nom = 't_secr'), '1', null, null, null, format('update public.stagiaires set delegue = ''titulaire'' where id = %s', v_stag_n), null))[2],
      (pg_temp.tenter((select email from pg_temp.perso where nom = 't_rh'), '1', null, null, null, format('update public.stagiaires set delegue = ''titulaire'' where id = %s', v_stag_n), null))[2]),
    'OK 0 / OK 1 / OK 0');
  perform pg_temp.attendre('coordonnees', 'stag_n lit le délégué de sa promo (stagiaires_select_all)',
    pg_temp.voir_apres(format('update public.stagiaires set delegue = ''titulaire'' where id = %s', v_cumul), 'stag_n', '1',
      format('select string_agg(id::text || '' '' || delegue, '','') from public.stagiaires where delegue is not null')),
    format('OK %s titulaire', v_cumul));
end $ca_gco$;

-- Groupe financements : la liste de chaque centre, livrée d'office (centres existants et centre créé), lue et réglée.
create or replace function pg_temp.groupe_financements()
returns void language plpgsql as $ca_gfi$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l2 integer := (select lieu_id from public.promos where id = 2);
  v_vide text := (select info from pg_temp.perso where nom = 'dir_vide');
  v_stag_n text := pg_temp.calcul(format('select stagiaire_id::text from public.user_profiles where email = %L', (select email from pg_temp.perso where nom = 'stag_n')));
  v_cpf_n text := pg_temp.calcul(format('select id::text from public.contact_financements where lieu_id = %s and libelle = ''CPF''', v_l1));
  v_cpf_m text := pg_temp.calcul(format('select id::text from public.contact_financements where lieu_id = %s and libelle = ''CPF''', v_l2));
  v_n1 text := pg_temp.calcul(format('select count(*)::text from public.contact_financements where lieu_id = %s', v_l1));
  e_dir_n text := (select email from pg_temp.perso where nom = 'dir_n');
  -- La liste de Nîmes telle qu'en base (jsonb), à retoucher par les essais : %s = une expression sur f (une ligne de la liste).
  c_liste constant text := $ca_q$select coalesce(jsonb_agg(x order by o), '[]'::jsonb)::text from (select f.ordre as o, %s as x from public.contact_financements f where f.lieu_id = %s) s where x is not null$ca_q$;
  c_regler constant text := 'select public.regler_financements(%s, %L::jsonb)::text';
  c_porte constant text := 'insert into public.stagiaires_prive (stagiaire_id, financement_id) values (%1$s, %2$s) on conflict (stagiaire_id) do update set financement_id = %2$s';
  v_liste text;
  c_brut constant text := $ca_q$jsonb_build_object('id', f.id, 'libelle', f.libelle, 'ordre', f.ordre, 'retire', f.retire)$ca_q$;
begin
  perform pg_temp.attendre('financements', 'sept financements par centre, pour chaque centre existant',
    pg_temp.calcul('select count(*) filter (where n <> 7)::text || ''/'' || count(*)::text from (select l.id, count(f.id) as n from public.lieux l left join public.contact_financements f on f.lieu_id = l.id group by l.id) x'),
    '0/' || pg_temp.calcul('select count(*)::text from public.lieux'));
  perform pg_temp.attendre('financements', 'la liste livrée d''office, dans l''ordre (centre sans promo de la preuve)',
    pg_temp.calcul(format('select string_agg(libelle || '' '' || ordre || '' '' || retire, '', '' order by ordre) from public.contact_financements where lieu_id = %s', v_vide)),
    'CPF 10 false, Région 20 false, France Travail 30 false, Contrat de professionnalisation 40 false, Entreprise 50 false, Personnel 60 false, Autre 70 false');
  perform pg_temp.attendre('financements', 'creer_centre par le siège : le centre créé reçoit ses sept financements',
    (pg_temp.tenter((select email from pg_temp.perso where nom = 'siege'), null, null, null, null, $ca_q$select public.creer_centre('Preuve centre')$ca_q$,
      $ca_q$select count(*)::text from public.contact_financements f join public.lieux l on l.id = f.lieu_id where l.nom = 'Preuve centre'$ca_q$))[2],
    'OK 1 7');
  -- Lecture.
  perform pg_temp.attendre('financements', 'financements_du_centre() : ceux de Nîmes à stag_n et à form_n, ceux de Montpellier à stag_m, aucun au siège sans promo ; anon : aucun droit',
    concat_ws(' / ',
      pg_temp.appeler('stag_n', '1', 'select count(*)::text || '' '' || (array_agg(libelle order by ordre))[1] from public.financements_du_centre()'),
      pg_temp.appeler('form_n', '1', 'select count(*)::text from public.financements_du_centre()'),
      pg_temp.appeler('stag_m', '2', format('select count(*) filter (where id = %s)::text from public.financements_du_centre()', v_cpf_m)),
      pg_temp.appeler('siege', null, 'select count(*)::text from public.financements_du_centre()'),
      pg_temp.valeur(null, '1', null, 'select count(*)::text from public.financements_du_centre()')),
    format('OK %1$s CPF / OK %1$s / OK 1 / OK 0 / ERREUR 42501', v_n1));
  perform pg_temp.attendre('financements', 'lecture directe de contact_financements : refusée (stag_n, dir_n)',
    pg_temp.valeur((select email from pg_temp.perso where nom = 'stag_n'), '1', null, 'select count(*)::text from public.contact_financements') || ' / '
      || pg_temp.valeur(e_dir_n, '1', null, 'select count(*)::text from public.contact_financements'),
    'ERREUR 42501 / ERREUR 42501');
  -- Réglage.
  v_liste := pg_temp.calcul(format(c_liste, c_brut, v_l1));
  perform pg_temp.attendre('financements', 'regler_financements par form_n, par stag_n, par dir_n sur Montpellier : refusé',
    concat_ws(' / ',
      pg_temp.appeler('form_n', '1', format(c_regler, v_l1, v_liste)),
      pg_temp.appeler('stag_n', '1', format(c_regler, v_l1, v_liste)),
      pg_temp.appeler('dir_n', '1', format(c_regler, v_l2, pg_temp.calcul(format(c_liste, c_brut, v_l2))))),
    concat_ws(' / ', 'ERREUR 42501 contact: Réservé aux réglages du centre.', 'ERREUR 42501 contact: Réservé aux réglages du centre.',
      'ERREUR 42501 contact: Réservé aux réglages du centre.'));
  perform pg_temp.attendre('financements', 'dir_n ajoute un financement (la liste d''avant et un nouveau) : OK, nom et ordre gardés',
    (pg_temp.tenter(e_dir_n, '1', null, null, null,
      format(c_regler, v_l1, pg_temp.json_plus(v_liste, '[{"id": null, "libelle": "  Preuve   financement ", "ordre": 75}]')),
      format('select count(*)::text || '' '' || max(libelle) filter (where ordre = 75) from public.contact_financements where lieu_id = %s', v_l1)))[2],
    format('OK 1 %s Preuve financement', pg_temp.calcul(format('select (%s + 1)::text', v_n1))));
  perform pg_temp.attendre('financements', 'supprimer un financement porté par un stagiaire : refusé ; le retirer : OK',
    pg_temp.voir_apres(format(c_porte, v_stag_n, v_cpf_n), 'dir_n', '1',
        format(c_regler, v_l1, pg_temp.calcul(format(c_liste, format('case when f.id <> %s then %s end', v_cpf_n, c_brut), v_l1)))) || ' / '
      || (pg_temp.tenter(e_dir_n, '1', null, format(c_porte, v_stag_n, v_cpf_n), null,
            format(c_regler, v_l1, pg_temp.calcul(format(c_liste, format('%s || jsonb_build_object(''retire'', f.id = %s)', c_brut, v_cpf_n), v_l1))),
            format('select retire::text || ''/'' || (select count(*) from public.contact_financements where lieu_id = %s)::text from public.contact_financements where id = %s', v_l1, v_cpf_n)))[2],
    format('ERREUR P0001 contact: Un financement choisi pour un stagiaire ne se supprime pas : retirez-le. / OK 1 true/%s', v_n1));
  perform pg_temp.attendre('financements', 'supprimer un financement que personne ne porte : OK',
    (pg_temp.tenter(e_dir_n, '1', null, format('update public.stagiaires_prive set financement_id = null where financement_id = %s', v_cpf_n), null,
      format(c_regler, v_l1, pg_temp.calcul(format(c_liste, format('case when f.id <> %s then %s end', v_cpf_n, c_brut), v_l1))),
      format('select count(*)::text || ''/'' || count(*) filter (where id = %s)::text from public.contact_financements where lieu_id = %s', v_cpf_n, v_l1)))[2],
    format('OK 1 %s/0', pg_temp.calcul(format('select (%s - 1)::text', v_n1))));
  perform pg_temp.attendre('financements', 'deux noms égaux (casse comprise), deux noms échangés, un identifiant de Montpellier, un nom de 41 caractères : refusés',
    concat_ws(' / ',
      pg_temp.appeler('dir_n', '1', format(c_regler, v_l1, pg_temp.json_plus(v_liste, '[{"libelle": "cpf"}]'))),
      pg_temp.appeler('dir_n', '1', format(c_regler, v_l1, pg_temp.calcul(format(c_liste,
        $ca_q$jsonb_build_object('id', f.id, 'libelle', case f.libelle when 'CPF' then 'Région' when 'Région' then 'CPF' else f.libelle end)$ca_q$, v_l1)))),
      pg_temp.appeler('dir_n', '1', format(c_regler, v_l1, pg_temp.json_plus(v_liste, format('[{"id": %s, "libelle": "Preuve"}]', v_cpf_m)))),
      pg_temp.appeler('dir_n', '1', format(c_regler, v_l1, pg_temp.json_plus(v_liste, format('[{"libelle": "%s"}]', repeat('x', 41)))))),
    concat_ws(' / ', 'ERREUR P0001 contact: Deux financements portent le même nom.', 'ERREUR P0001 contact: Deux financements portent le même nom.',
      'ERREUR P0001 contact: Financement inconnu dans ce centre.', 'ERREUR P0001 contact: Le nom d''un financement compte de 1 à 40 caractères.'));
  perform pg_temp.attendre('financements', 'les financements suivent leur centre (suppression du centre sans promo de la preuve)',
    pg_temp.ecrire_proprio(format('delete from public.affectations where lieu_id = %1$s; delete from public.titres where lieu_id = %1$s; delete from public.lieux where id = %1$s', v_vide),
      format('select count(*)::text from public.contact_financements where lieu_id = %s', v_vide)),
    'OK 1 0');
end $ca_gfi$;

-- Le nombre de profils du personnel (sans fiche, rôle autre que stagiaire) lus par chacun : « form_n=OK n dir_n=OK n siege=OK n ».
create or replace function pg_temp.lus_personnel(p_qui text[])
returns text language plpgsql as $ca_lp$
declare q text; r text := '';
begin
  foreach q in array p_qui loop
    r := r || q || '=' || pg_temp.appeler(q, null, 'select count(*)::text from public.user_profiles where stagiaire_id is null and role <> ''stagiaire''') || ' ';
  end loop;
  return rtrim(r);
end $ca_lp$;

-- Groupe profils : les profils du personnel (adresse comprise) ne se lisent plus par un stagiaire ni en aperçu stagiaire ; l'équipe
-- et le siège en lisent autant qu'avant la migration (p_avant : relevé avant elle, dans ce bloc).
create or replace function pg_temp.groupe_profils(p_avant text)
returns void language plpgsql as $ca_gpr$
declare
  -- Les profils du personnel autres que le sien, puis le sien.
  c_perso constant text := 'select count(*) filter (where stagiaire_id is null and role <> ''stagiaire'' and lower(email) <> lower(%1$L))::text || ''/'' || count(*) filter (where lower(email) = lower(%1$L))::text from public.user_profiles';
  v_total text := pg_temp.calcul('select count(*)::text from public.user_profiles where stagiaire_id is null and role <> ''stagiaire''');
begin
  perform pg_temp.verifier('profils', 'des profils du personnel existent (jamais un contrôle à vide)', v_total ~ '^[0-9]+$' and v_total::integer > 0, 'obtenu ' || coalesce(v_total, 'nul'));
  perform pg_temp.attendre('profils', 'stag_n et stag_m : 0 profil du personnel, et le leur (leur profil de stagiaire)',
    pg_temp.appeler('stag_n', '1', format(c_perso, (select email from pg_temp.perso where nom = 'stag_n'))) || ' / '
      || pg_temp.appeler('stag_m', '2', format(c_perso, (select email from pg_temp.perso where nom = 'stag_m'))),
    'OK 0/1 / OK 0/1');
  perform pg_temp.attendre('profils', 'le fondateur et form_n en aperçu stagiaire : 0 profil du personnel (hors le leur), et le leur',
    pg_temp.valeur((select email from pg_temp.perso where nom = 'fond'), '1', 'stagiaire', format(c_perso, (select email from pg_temp.perso where nom = 'fond'))) || ' / '
      || pg_temp.valeur((select email from pg_temp.perso where nom = 'form_n'), '1', 'stagiaire', format(c_perso, (select email from pg_temp.perso where nom = 'form_n'))),
    '0/1 / 0/1');
  perform pg_temp.attendre('profils', 'form_n, dir_n, siege : autant de profils du personnel qu''avant la migration',
    pg_temp.lus_personnel(array['form_n', 'dir_n', 'siege']), p_avant);
  perform pg_temp.attendre('profils', 'form_n, dir_n, siege, cumul (fiche de stagiaire et formateur), le fondateur hors aperçu : tous les profils du personnel',
    pg_temp.lus_personnel(array['form_n', 'dir_n', 'siege', 'cumul', 'fond']),
    format('form_n=OK %1$s dir_n=OK %1$s siege=OK %1$s cumul=OK %1$s fond=OK %1$s', v_total));
  perform pg_temp.attendre('profils', 'dir_vide (direction d''un centre sans promo), t_contenus (siège, titre sans « Directions »), sans_role, ancien_form : toujours aucun profil du personnel autre que le leur',
    concat_ws(' / ',
      pg_temp.appeler('dir_vide', null, format(c_perso, (select email from pg_temp.perso where nom = 'dir_vide'))),
      pg_temp.appeler('t_contenus', null, format(c_perso, (select email from pg_temp.perso where nom = 't_contenus'))),
      pg_temp.appeler('sans_role', null, format(c_perso, (select email from pg_temp.perso where nom = 'sans_role'))),
      pg_temp.appeler('ancien_form', null, format(c_perso, (select email from pg_temp.perso where nom = 'ancien_form')))),
    'OK 0/1 / OK 0/1 / OK 0/1 / OK 0/1');
end $ca_gpr$;

-- Groupe demo : les trois fiches fictives du centre de démonstration (20261115_contact_demo.sql). Joué seulement quand la fiche
-- « Responsable pédagogique (fictif) » existe (la migration de démonstration n'est jamais injectée par cette preuve : elle se joue en mode
-- en ligne, après son application réelle). Toutes les valeurs sont fictives (adresses en demo.test, numéros en 01 99 00) ; aucun
-- stagiaire de Nîmes n'en voit une.
create or replace function pg_temp.groupe_demo()
returns void language plpgsql as $ca_gdm$
declare
  v_l4 integer := (select lieu_id from public.promos where id = 7);
  v_ids text := coalesce(pg_temp.calcul(format('select string_agg(id::text, '','' order by id) from public.contacts where compte_email is null and lieu_id = %s', v_l4)), '0');
  v_resp text := coalesce(pg_temp.calcul(format('select id::text from public.contacts where compte_email is null and lieu_id = %s and prenom = ''Responsable pédagogique (fictif)''', v_l4)), '0');
begin
  perform pg_temp.attendre('demo', 'le centre de démonstration a exactement trois fiches sans compte',
    pg_temp.calcul(format('select count(*)::text from public.contacts where compte_email is null and lieu_id = %s', v_l4)), '3');
  perform pg_temp.attendre('demo', 'les trois sont fictives : adresse en demo.test, numéro en 01 99 00, jamais autre chose',
    pg_temp.calcul(format($ca_q$select concat_ws('/', count(*)::text,
        count(*) filter (where email ~ '@demo\.test$' and phone like '01 99 00 %%')::text,
        count(*) filter (where pour_quoi is not null and quand is not null)::text)
      from public.contacts where compte_email is null and lieu_id = %s$ca_q$, v_l4)), '3/3/3');
  perform pg_temp.attendre('demo', 'la responsable est le relais d''« Accueil du centre » (et lui seul)',
    pg_temp.calcul(format($ca_q$select concat_ws('/', (select count(*) from public.contacts where relais_id = %1$s)::text,
        (select count(*) from public.contacts where relais_id = %1$s and prenom = 'Accueil du centre' and lieu_id = %2$s)::text)$ca_q$, v_resp, v_l4)), '1/1');
  perform pg_temp.attendre('demo', 'stag_s (promo 7) lit les trois fiches, avec « pour quoi » et « quand », joignables, et le relais d''Accueil',
    pg_temp.appeler('stag_s', '7', format($ca_q$select concat_ws('/', count(*) filter (where id in (%s))::text,
        count(*) filter (where id in (%s) and pour_quoi is not null and quand is not null and joignable)::text,
        coalesce(max(relais_id) filter (where nom_affiche = 'Accueil du centre'), 0)::text) from public.annuaire_centre()$ca_q$, v_ids, v_ids)),
    'OK 3/3/' || v_resp);
  perform pg_temp.attendre('demo', 'aucun stagiaire de Nîmes (stag_n, promo 1) ne voit une des trois fiches',
    pg_temp.appeler('stag_n', '1', format('select count(*) filter (where id in (%s))::text from public.annuaire_centre()', v_ids)), 'OK 0');
end $ca_gdm$;

-- Un groupe se joue-t-il dans ce mode ? Contre-épreuve : toujours (il doit être rouge). En ligne : seulement si p_condition (la
-- migration qui le fonde est appliquée), sinon une ligne d'information. Migrations injectées : toujours.
create or replace function pg_temp.groupe_a_jouer(p_groupe text, p_mode text, p_condition boolean, p_raison text)
returns boolean language plpgsql as $ca_gj$
begin
  if p_mode like 'contact-1-en-ligne%' and not coalesce(p_condition, false) then
    perform pg_temp.informer('groupe ' || p_groupe, 'sauté : ' || p_raison || ' (mode en ligne)');
    return false;
  end if;
  return true;
end $ca_gj$;

do $tpc1$
declare
  v_mode constant text :=
-- @@MODE@@
  ;
  v_debut constant timestamptz := clock_timestamp();
  v_en_ligne boolean;
  v_etat1 text; v_etat1b text; v_retour1b text; v_retour1 text;
  v_av_regles text; v_av_fonctions text; v_av_droits text;
  v_ap_regles text; v_ap_fonctions text; v_ap_droits text;
  v_av_lignes text; v_av_fiches text; v_ap_fiches text;
  v_av_profils text;
  v_jouees integer;
  c_fiches constant text := $ca_q$select md5(coalesce(string_agg(l, E'\n' order by l collate "C"), '')) from (select concat_ws('|', prenom, role, phone, email, note, category, sort_order, lieu_id, created_at, updated_at) as l from public.contacts) s$ca_q$;
begin
  perform set_config('lock_timeout', '3s', true);
  v_en_ligne := v_mode like 'contact-1-en-ligne%';

  -- 1. Avant les migrations : l'empreinte de la base, puis les prérequis de l'état de départ (la production du 14/11).
  select e.regles, e.fonctions, e.droits into v_av_regles, v_av_fonctions, v_av_droits from pg_temp.empreinte() e;
  perform pg_temp.verifier('structure', 'prérequis : geste_promo(integer, text) existe (titres, migration 2)',
    to_regprocedure('public.geste_promo(integer, text)') is not null);
  perform pg_temp.verifier('structure', 'prérequis : retirer_titre(text, bigint, integer) existe (titres, migration 5)',
    to_regprocedure('public.retirer_titre(text, bigint, integer)') is not null);
  perform pg_temp.verifier('structure', 'prérequis : donner_titre(text, bigint, integer, integer[], integer) existe (titres, migration 6)',
    to_regprocedure('public.donner_titre(text, bigint, integer, integer[], integer)') is not null);
  perform pg_temp.verifier('structure', 'prérequis : contacts.lieu_id existe (20261113_contacts_centre)',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'contacts' and column_name = 'lieu_id'));

  -- 2. Les personnages, posés AVANT les migrations (comme les comptes de la production) : ceux du lot 4, des titres et la fiche sec_n,
  --    puis les données d'essai de la partie A (comptes rattachés à profs, copies).
  perform pg_temp.poser_contact();
  perform pg_temp.attendre('structure', 'les personnages sont posés (16 du lot 4, 5 des titres, la fiche sans compte sec_n)',
    pg_temp.calcul($q$select concat_ws('/',
      (select count(*) from perso where ordre between 1 and 16)::text,
      (select count(*) from perso where ordre between 20 and 24)::text,
      (select count(*) from perso p join public.contacts c on c.id = p.info::bigint
         where p.nom = 'sec_n' and c.email = 'preuve.sec@exemple.invalid' and c.prenom = 'Preuve Secrétariat'
           and c.lieu_id = (select lieu_id from public.promos where id = 1))::text)$q$),
    '16/5/1');
  perform pg_temp.poser_annuaire();
  insert into pg_temp.annuaire_ids values ('sec_n', (select info::bigint from pg_temp.perso where nom = 'sec_n'));
  perform pg_temp.attendre('structure', 'données d''essai de la partie A posées (ligne profs, deux comptes, quatre lignes de copies)',
    pg_temp.calcul('select count(*)::text from pg_temp.annuaire_ids'), '6');
  -- Les fiches sans compte d'avant, deux empreintes : leurs valeurs ligne par ligne avec leur centre (pour la fusion), et la table entière
  -- (pour le retour : copies refaites, dates comprises).
  v_av_lignes := pg_temp.calcul($ca_q$select md5(coalesce(string_agg(l, E'\n' order by l collate "C"), '')) from (select concat_ws('|', prenom, role, phone, email, note, category, lieu_id) as l from public.contacts) s$ca_q$);
  v_av_fiches := pg_temp.calcul(c_fiches);
  -- Les profils du personnel lus par l'équipe et le siège, avant la migration (groupe profils : autant après).
  v_av_profils := pg_temp.lus_personnel(array['form_n', 'dir_n', 'siege']);

  -- 3. Les migrations, dans l'ordre d'application (neutralisées dans les modes sans elles) : la 1, l'intervalle, puis la 1b.
  v_etat1 := pg_temp.jouer('migration 1',
-- @@INJECTER supabase/migrations/20261115_contact_1_annuaire.sql@@
  );
  perform pg_temp.etape('migration 1', v_etat1, v_mode);

  -- 4. GROUPES de contrôles de la partie 1.
  -- 4a. L'intervalle : la 1 sans la 1b.
  if pg_temp.groupe_a_jouer('entre', v_mode,
       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'contacts' and column_name = 'compte_email')
       and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contacts' and policyname = 'contacts_select_authenticated' and qual = 'true'),
       'la migration 1 n''est pas appliquée, ou la 1b l''est déjà') then
    perform pg_temp.groupe_entre();
  end if;

  v_etat1b := pg_temp.jouer('migration 1b',
-- @@INJECTER supabase/migrations/20261115_contact_1b_fermeture.sql@@
  );
  perform pg_temp.etape('migration 1b', v_etat1b, v_mode);

  -- 4b. La migration 1 en place (et la 1b, sauf en ligne entre les deux).
  if pg_temp.groupe_a_jouer('fiches', v_mode, to_regprocedure('public.annuaire_centre()') is not null, 'la migration 1 n''est pas appliquée') then
    perform pg_temp.groupe_fiches(not v_en_ligne, v_av_lignes);
  end if;
  if pg_temp.groupe_a_jouer('annuaire', v_mode, to_regprocedure('public.annuaire_centre()') is not null, 'la migration 1 n''est pas appliquée') then
    perform pg_temp.groupe_annuaire(not v_en_ligne);
  end if;
  if pg_temp.groupe_a_jouer('ecritures', v_mode, to_regprocedure('public.annuaire_centre()') is not null, 'la migration 1 n''est pas appliquée') then
    perform pg_temp.groupe_ecritures();
  end if;
  if pg_temp.groupe_a_jouer('depart', v_mode, to_regprocedure('public.annuaire_centre()') is not null, 'la migration 1 n''est pas appliquée') then
    perform pg_temp.groupe_depart();
  end if;
  -- 4c. Partie B : ma fiche, coordonnées et délégué, financements, profils du personnel.
  if pg_temp.groupe_a_jouer('ma_fiche', v_mode, to_regprocedure('public.ma_fiche_contact()') is not null, 'la migration 1 (partie B) n''est pas appliquée') then
    perform pg_temp.groupe_ma_fiche();
  end if;
  if pg_temp.groupe_a_jouer('coordonnees', v_mode, to_regprocedure('public.coordonnees_promo()') is not null, 'la migration 1 (partie B) n''est pas appliquée') then
    perform pg_temp.groupe_coordonnees();
  end if;
  if pg_temp.groupe_a_jouer('financements', v_mode, to_regclass('public.contact_financements') is not null, 'la migration 1 (partie B) n''est pas appliquée') then
    perform pg_temp.groupe_financements();
  end if;
  if pg_temp.groupe_a_jouer('profils', v_mode, to_regprocedure('public._contact_compte_equipe()') is not null, 'la migration 1 (partie B) n''est pas appliquée') then
    perform pg_temp.groupe_profils(v_av_profils);
  end if;
  if pg_temp.groupe_a_jouer('fermeture', v_mode,
       exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contacts' and policyname = 'contacts_select_authenticated' and qual <> 'true'),
       'la migration 1b n''est pas appliquée') then
    perform pg_temp.groupe_fermeture();
  end if;
  if exists (select 1 from public.contacts where prenom = 'Responsable pédagogique (fictif)') then
    perform pg_temp.groupe_demo();
  else
    perform pg_temp.informer('groupe demo', 'sauté : la fiche « Responsable pédagogique (fictif) » n''existe pas (migration de démonstration non appliquée)');
  end if;

  -- 5. Les retours, dans l'ordre inverse (1b, 1).
  v_retour1b := pg_temp.jouer('retour 1b',
-- @@INJECTER supabase/migrations/20261115_contact_1b_fermeture_retour.sql@@
  );
  perform pg_temp.etape('retour 1b', v_retour1b, v_mode);
  v_retour1 := pg_temp.jouer('retour 1',
-- @@INJECTER supabase/migrations/20261115_contact_1_annuaire_retour.sql@@
  );
  perform pg_temp.etape('retour 1', v_retour1, v_mode);
  select e.regles, e.fonctions, e.droits into v_ap_regles, v_ap_fonctions, v_ap_droits from pg_temp.empreinte() e;
  v_ap_fiches := pg_temp.calcul(c_fiches);
  v_jouees := (v_etat1 = 'jouée')::integer + (v_etat1b = 'jouée')::integer;
  if v_en_ligne or v_jouees = 0 then
    perform pg_temp.informer('retours', format('non jugeables (aucune migration injectée, ou déjà appliquées) ; empreinte du moment : regles %s, fonctions %s, droits %s',
      v_ap_regles, v_ap_fonctions, v_ap_droits));
  else
    perform pg_temp.attendre('retour', 'après les retours : empreinte regles identique à celle d''avant', v_ap_regles, v_av_regles);
    perform pg_temp.attendre('retour', 'après les retours : empreinte fonctions identique à celle d''avant', v_ap_fonctions, v_av_fonctions);
    perform pg_temp.attendre('retour', 'après les retours : empreinte droits identique à celle d''avant', v_ap_droits, v_av_droits);
    perform pg_temp.attendre('retour', 'après les retours : les fiches sans compte sont celles d''avant (copies refaites, dates comprises)', v_ap_fiches, v_av_fiches);
  end if;
  perform pg_temp.informer('durée du bloc', to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0') || ' s');
  perform pg_temp.verdict_titres(v_mode, v_debut);
  raise exception 'la preuve doit finir par la levée du verdict';
end $tpc1$;
