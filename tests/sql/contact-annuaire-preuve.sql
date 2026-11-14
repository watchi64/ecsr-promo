-- Preuve de la partie 1 du chantier « espace contact » : l'annuaire : fiches de contact rattachées à un compte, coordonnées, délégué. Écrite avec les migrations
-- 20261115_contact_1_annuaire et 20261115_contact_1b_fermeture, jouée sur une base où l'état de la production est rejoué
-- (outils/base_locale : reconstruire.sh, puis rejouer_suite.sh --titres 1,2,3,5,6 --autonomie --autonomie-version 2026-11-14).
--   structure    prérequis de l'état de départ présents (geste_promo, retirer_titre, donner_titre, contacts.lieu_id), personnages posés
--                (pg_temp.poser_contact, pg_temp.poser_annuaire), chaque migration et chaque retour injectés se jouent sans erreur.
--   entre        après la 1, avant la 1b (l'intervalle de la production entre les deux) : la lecture directe des anciens lecteurs marche
--                encore, ne montre aucune fiche avec compte et aucun champ nouveau rempli.
--   fiches       une fiche d'office par adresse de formateur ou de direction, aucune pour les autres ; elle naît avec la première
--                affectation, disparaît avec la dernière ; rattachement à profs ; copies identiques fusionnées, copie modifiée à part,
--                valeurs des fiches sans compte gardées (centres des copies compris).
--   annuaire     annuaire_centre() : les fiches du centre de la promo affichée et les fiches partagées avec lui, masque d'une fiche non
--                vérifiée, champs d'édition rendus à qui écrit, titres du centre, tri.
--   ecritures    écritures directes : fiches sans compte de son centre seulement, colonnes permises, partage jugé centre par centre,
--                relais d'un des centres de la fiche.
--   depart       date de départ d'une fiche sans compte : passée, la fiche n'est plus rendue qu'à qui l'écrit.
--   fermeture    après la 1b : la lecture directe de contacts n'est plus ouverte qu'à qui écrit les fiches.
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
  if pg_temp.groupe_a_jouer('fermeture', v_mode,
       exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contacts' and policyname = 'contacts_select_authenticated' and qual <> 'true'),
       'la migration 1b n''est pas appliquée') then
    perform pg_temp.groupe_fermeture();
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
