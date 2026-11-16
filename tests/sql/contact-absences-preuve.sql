-- Preuve de la partie 3 du chantier « espace contact » : les absences annoncées. Écrite avec les migrations 20261115_contact_1_annuaire,
-- 20261115_contact_2_demandes, 20261115_contact_3_absences, jouée sur une base où l'état de la production est rejoué
-- (outils/base_locale : reconstruire.sh, puis rejouer_suite.sh --titres 1,2,3,5,6 --autonomie --autonomie-version 2026-11-14).
--   structure    prérequis de l'état de départ présents (geste_promo, retirer_titre, donner_titre, contacts.lieu_id), personnages posés
--                (pg_temp.poser_contact, puis pg_temp.poser_absences), chaque migration et chaque retour injectés se jouent sans erreur.
--   prevenir     sans règle, le stagiaire choisit (formateur du jour pré-coché) ; principal, formateurs du jour en annexe (sauf déjà
--                principaux), noms non prévenus (prof_autre), délégué titulaire avec compte (jamais principal ; ni le suppléant sans
--                compte), cases décochées ; refus (sans choix, jour passé, plage sur deux jours, motif inconnu) ; jours ouvrés (C-22) et
--                plage rattachée à sa demi-journée (C-24).
--   delegue      le délégué ne lit que le nom, le jour et la demi-journée (liste_demandes), jamais une absence annulée, jamais le détail ;
--                aucune colonne de ses lignes ne contient le motif.
--   annuler      l'auteur jusqu'au début de la demi-journée (C-13 : 09:00 par défaut, l'heure de début d'une plage), l'équipe ensuite ;
--                peut.annuler de demande_detail suit la même règle ; envois annulation et annulation_absence.
--   justificatif réponse toute faite qui le demande (« à remettre »), mes_justificatifs_a_remettre, regler_justificatif (qui peut), file des
--                envois (jours, jamais le motif), lien d'e-mail (motif, mot, jours, moment ; « Justificatif reçu » une seule fois).
--   emargement   pré-marquage à l'ouverture, refus de signer, « Absence justifiée », plage (observation seule, le stagiaire signe), absence
--                annoncée après l'ouverture, annulation (ligne rendue, signature intacte), clore puis rouvrir, observation du formateur.
--   planning     absences_annoncees_semaine : la promo affichée seulement, jamais le motif, absences annulées exclues, rien sans le planning.
--   conservation changement de promo, effacement (étape 1 : la ligne reste, motif compris ; mot et réponses partent), anonymisation (étape 2
--                par effacer_sur_demande : motif effacé, la ligne reste).
--   retour       migration 3 rejouée : refusée ; retour 3 refusé tant qu'une ligne d'émargement est « annoncee » ; après le retour 3,
--                l'empreinte et md5(pg_get_functiondef) des huit fonctions redéfinies égalent ceux d'avant la migration 3 ; les retours
--                défont tout, dans l'ordre inverse (3, 2, 1b, 1) : l'empreinte égale celle d'avant.
-- L'horloge : après la migration 2, _contact_maintenant() lit le réglage preuve.maintenant (C-21) ; le jour de l'émargement aussi, le temps
-- du groupe emargement. Les jours d'essai : mercredi 18 et jeudi 19 novembre 2026 (C-21 : jour ouvré posé par la preuve).
-- Modes : dans la contre-épreuve, chaque groupe de la partie 3 se joue et doit être ROUGE ; en ligne, un groupe dont la migration n'est pas
-- appliquée est sauté (ligne d'information).
-- GABARIT, à ne pas jouer tel quel : outils/assembler_repetition_roles.mjs y colle les aides communes (roles-aides.sql, titres-aides.sql,
-- contact-aides.sql), le libellé du mode, la requête d'empreinte, puis les migrations 1 à 3 et leurs retours :
--   node outils/assembler_repetition_roles.mjs contact-3 <sortie.sql>                 migrations injectées : VERT attendu
--   node outils/assembler_repetition_roles.mjs contact-3-contre-epreuve <sortie.sql>  la 3 et son retour neutralisés : ROUGE attendu
--                                                                                      sur les seuls contrôles de la partie 3
--   node outils/assembler_repetition_roles.mjs contact-3-en-ligne <sortie.sql>        rien d'injecté, après application réelle
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

-- L'adresse d'un personnage.
create or replace function pg_temp.email_de(p_qui text)
returns text language plpgsql as $ab_em$
begin
  return (select email from pg_temp.perso where nom = p_qui);
end $ab_em$;

-- Les fiches des personnages, par nom (pg_temp.cles) : fiche avec compte (compte_email), ou la fiche sans compte sec_n. Posée après la
-- migration 1 ; un personnage sans fiche n'y figure pas.
create or replace function pg_temp.poser_cles()
returns void language plpgsql as $ab_pc$
begin
  drop table if exists pg_temp.cles;
  create temp table cles (cle text primary key, fiche_id bigint not null);
  begin
    execute $ab_q$insert into pg_temp.cles (cle, fiche_id)
      select p.nom, c.id from pg_temp.perso p join public.contacts c on c.compte_email = lower(p.email)
      union all
      select p.nom, p.info::bigint from pg_temp.perso p where p.nom = 'sec_n'$ab_q$;
  exception when others then
    null; -- migration 1 absente : la table reste vide, les contrôles qui s'en servent sont rouges
  end;
end $ab_pc$;

-- La fiche d'un personnage (texte), ou « null ».
create or replace function pg_temp.fiche(p_cle text)
returns text language plpgsql as $ab_fi$
begin
  return coalesce((select fiche_id::text from pg_temp.cles where cle = p_cle), 'null');
end $ab_fi$;

-- La fiche stagiaire d'un personnage (texte), ou « null ».
create or replace function pg_temp.stag(p_qui text)
returns text language plpgsql as $ab_st$
begin
  return coalesce((select up.stagiaire_id::text from public.user_profiles up where up.email = pg_temp.email_de(p_qui)), 'null');
end $ab_st$;

-- L'identifiant rendu par un appel réussi (« OK 12 » : 12), sinon « null » (le constat qui s'en sert est alors rouge).
create or replace function pg_temp.id_rendu(p_appel text)
returns text language sql as $ab_ir$
  select case when p_appel ~ '^OK [0-9]+$' then substr(p_appel, 4) else 'null' end;
$ab_ir$;

-- L'horloge de la preuve (heure de Paris).
create or replace function pg_temp.horloge(p_quand text)
returns void language sql as $ab_ho$
  select set_config('preuve.maintenant', p_quand || ' Europe/Paris', true);
$ab_ho$;

-- Les absences d'essai, par nom (pg_temp.ab) : poser_ab range l'identifiant rendu, ab le relit (« null » sinon).
create or replace function pg_temp.poser_ab(p_nom text, p_appel text)
returns text language plpgsql as $ab_pa$
begin
  if to_regclass('pg_temp.ab') is null then
    create temp table ab (nom text primary key, id bigint);
  end if;
  delete from pg_temp.ab where nom = p_nom;
  if p_appel ~ '^OK [0-9]+$' then
    insert into pg_temp.ab values (p_nom, substr(p_appel, 4)::bigint);
  end if;
  return p_appel;
end $ab_pa$;

create or replace function pg_temp.ab(p_nom text)
returns text language plpgsql as $ab_ab$
begin
  return coalesce((select id::text from pg_temp.ab where nom = p_nom), 'null');
exception when others then
  return 'null';
end $ab_ab$;

-- Prévenir d'une absence, par un personnage (en-tête de la promo 1) : « OK <id> » ou « ERREUR <état> <message> ». p_choisis : une
-- expression SQL (« array[12]::bigint[] ») ou nul.
create or replace function pg_temp.prevenir(p_qui text, p_du text, p_au text, p_quand text, p_debut text, p_fin text, p_motif text, p_mot text,
                                            p_sans text, p_choisis text)
returns text language sql as $ab_pv$
  select pg_temp.appeler(p_qui, '1', format('select public.prevenir_absence(%L::date, %L::date, %L, %L, %L, %L, %L, %L::text[], %s)::text',
    p_du, p_au, p_quand, p_debut, p_fin, p_motif, p_mot, coalesce(p_sans, '{}'), coalesce(p_choisis, 'null')));
$ab_pv$;

-- Un appel en service_role (la fonction serveur) : la valeur jsonb rendue, ou {"erreur": "<état> <message>"}. Rend la main au propriétaire.
create or replace function pg_temp.srv(p_sql text)
returns jsonb language plpgsql as $ab_sv$
declare
  v jsonb;
begin
  perform pg_temp.proprio();
  set local role service_role;
  begin
    execute p_sql into v;
  exception when others then
    v := jsonb_build_object('erreur', sqlstate || ' ' || sqlerrm);
  end;
  perform pg_temp.proprio();
  return coalesce(v, 'null'::jsonb);
end $ab_sv$;

-- Toutes les absences d'essai effacées (en propriétaire) : chaque groupe part d'une base sans absence (et sans quota entamé).
create or replace function pg_temp.vider_absences()
returns void language sql as $ab_va$
  select pg_temp.essai($ab_q$delete from public.demandes where type = 'absence'$ab_q$);
$ab_va$;

-- Les destinataires d'une demande, dans l'ordre : « fiche:P » (principal), « fiche:annexe », « s<stagiaire>:delegue », « n:annexe:nom » (sans
-- fiche, non prévenu).
create or replace function pg_temp.dest_de(p_id text)
returns text language sql as $ab_dd$
  select pg_temp.calcul(format($ab_q$select coalesce(string_agg(coalesce(x.fiche_id::text, 's' || x.stagiaire_id, 'n') || ':'
      || case when x.principal then 'P' else x.annexe end || coalesce(':' || x.non_prevenu, ''), ',' order by x.id), '')
    from public.demande_destinataires x where x.demande_id = %s$ab_q$, p_id));
$ab_dd$;

-- Les envois d'une demande, dans l'ordre : « vers:evenement » (vers = la fiche, ou s suivi du stagiaire).
create or replace function pg_temp.envois_de(p_id text)
returns text language sql as $ab_ed$
  select pg_temp.calcul(format($ab_q$select coalesce(string_agg(coalesce(e.vers_fiche_id::text, 's' || e.vers_stagiaire_id) || ':' || e.evenement, ','
      order by e.id), '') from public.contact_envois e where e.demande_id = %s$ab_q$, p_id));
$ab_ed$;

-- Les envois d'une demande nés après l'envoi p_apres : « vers:evenement:etat ».
create or replace function pg_temp.envois_apres(p_id text, p_apres text)
returns text language sql as $ab_ea$
  select pg_temp.calcul(format($ab_q$select coalesce(string_agg(coalesce(e.vers_fiche_id::text, 's' || e.vers_stagiaire_id) || ':' || e.evenement || ':' || e.etat,
      ',' order by e.id), '') from public.contact_envois e where e.demande_id = %s and e.id > %s$ab_q$, p_id, p_apres));
$ab_ea$;

-- Le dernier envoi (identifiant en texte, 0 sans aucun).
create or replace function pg_temp.dernier_envoi()
returns text language sql as $ab_de$
  select pg_temp.calcul('select coalesce(max(id), 0)::text from public.contact_envois');
$ab_de$;

-- La ligne d'émargement d'un personnage sur une feuille : « absent|origine|observation|signée », ou « aucune ligne ».
create or replace function pg_temp.ligne(p_seance text, p_qui text)
returns text language sql as $ab_li$
  select coalesce(pg_temp.calcul(format($ab_q$select concat_ws('|', absent::text, coalesce(absence_origine, '-'), coalesce(observation, '-'), (trace is not null)::text)
      from public.emargement_lignes where seance_id = %s and stagiaire_id = %s$ab_q$, p_seance, pg_temp.stag(p_qui))), 'aucune ligne');
$ab_li$;

-- md5(pg_get_functiondef) des huit fonctions de la migration 2 que la migration 3 redéfinit : « nom=md5,... ».
create or replace function pg_temp.md5_huit()
returns text language sql as $ab_m5$
  select coalesce(string_agg(p.proname || '=' || md5(pg_get_functiondef(p.oid)), ',' order by p.proname), 'aucune')
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('apercu_envoi', 'liste_demandes', 'demande_detail', 'annuler_demande', 'repondre_demande',
                       '_contact_srv_prendre', '_contact_srv_lien', '_contact_srv_agir');
$ab_m5$;

-- Un texte (migration, retour) joué puis TOUJOURS annulé : « refusée <état> <message> », ou « acceptée (annulée) ».
create or replace function pg_temp.essayer_et_annuler(p_sql text)
returns text language plpgsql as $ab_en$
begin
  begin
    execute p_sql;
    raise exception using errcode = 'P0001', message = 'AB_ACCEPTEE';
  exception when others then
    if sqlerrm = 'AB_ACCEPTEE' then
      return 'acceptée (annulée)';
    end if;
    return 'refusée ' || sqlstate || ' ' || left(sqlerrm, 160);
  end;
end $ab_en$;

-- Les personnages de cette preuve, posés après les migrations (stagiaires.delegue vient de la migration 1) : cinq stagiaires de la promo 1,
-- deleg (délégué titulaire, avec compte), supp (suppléant, sans compte), stag_h, stag_k et stag_o (avec compte) ; form_n au planning du
-- jeudi 19 novembre au matin (une ligne profs rattachée à sa fiche) ; « Karim (fictif) », saisi à la main au planning, le jeudi 19 après-midi ;
-- aucune règle dans le centre de la promo 1 (mode choix). Si une pose échoue (contre-épreuve), une ligne d'information le dit.
create or replace function pg_temp.poser_absences()
returns void language plpgsql as $ab_po$
declare
  r record;
  v_s integer;
  v_prof integer;
  v_email text;
begin
  for r in select * from (values (50, 'deleg', 'titulaire', true), (51, 'supp', 'suppleant', false), (52, 'stag_h', null, true),
                                 (53, 'stag_k', null, true), (54, 'stag_o', null, true)) x(ordre, nom, delegue, compte) loop
    v_email := 'preuve14.' || replace(r.nom, '_', '.') || '@exemple.invalid';
    execute format('insert into public.stagiaires (prenom, nom, ordre, promo_id, delegue) values (%L, %L, 990, 1, %L) returning id',
                   'Preuve14 ' || r.nom, 'PREUVE', r.delegue) into v_s;
    insert into pg_temp.perso (ordre, nom, email, role, info) values (r.ordre, r.nom, v_email, 'stagiaire', v_s::text);
    if r.compte then
      insert into public.user_profiles (email, role, is_admin, stagiaire_id) values (v_email, 'stagiaire', false, v_s);
    end if;
  end loop;
  insert into public.profs (nom, ordre) values ('Preuve14 form_n', 995) returning id into v_prof;
  update public.contacts set prof_id = v_prof where id = (select fiche_id from pg_temp.cles where cle = 'form_n');
  insert into public.planning_entries (promo_id, semaine_lundi, day_index, half_day, slot, prof_id) values (1, date '2026-11-16', 3, 'matin', 950, v_prof);
  insert into public.planning_entries (promo_id, semaine_lundi, day_index, half_day, slot, prof_autre)
    values (1, date '2026-11-16', 3, 'aprem', 951, 'Karim (fictif)');
  delete from public.contact_regles where lieu_id = (select lieu_id from public.promos where id = 1);
exception when others then
  perform pg_temp.informer('personnages des absences', 'pose impossible : ' || sqlstate || ' ' || left(sqlerrm, 160));
end $ab_po$;

-- Groupe prevenir. Le mercredi 18 novembre 2026, 18 h : stag_n prévient pour le jeudi 19 et après.
create or replace function pg_temp.groupe_prevenir()
returns void language plpgsql as $ab_gp$
declare
  f_form_n text := pg_temp.fiche('form_n');
  f_dir_n text := pg_temp.fiche('dir_n');
  s_n text := pg_temp.stag('stag_n');
  s_deleg text := pg_temp.stag('deleg');
  v text;
  v_id text;
  c_apercu constant text := $ab_q$select concat_ws('|', a ->> 'mode',
      coalesce((select x ->> 'pre_coche' from jsonb_array_elements(a -> 'possibles') x where x ->> 'fiche_id' = %1$L), 'absent'),
      jsonb_array_length(a -> 'annexes' -> 'formateurs'),
      coalesce((select string_agg(x ->> 'nom', ',' order by x ->> 'nom') from jsonb_array_elements(a -> 'annexes' -> 'non_prevenus') x), 'aucun'),
      coalesce((select string_agg(x ->> 'nom', ',' order by x ->> 'nom') from jsonb_array_elements(a -> 'annexes' -> 'delegues') x), 'aucun'))
    from (select public.apercu_envoi('absence', %2$L::jsonb) a) s$ab_q$;
  c_choix constant text := 'array[%s]::bigint[]';
begin
  perform pg_temp.horloge('2026-11-18 18:00');
  perform pg_temp.vider_absences();
  perform pg_temp.attendre('prevenir', 'apercu_envoi(absence, jeudi 19 matin) par stag_n, sans règle : mode choix, form_n (au planning) pré-coché, aucun formateur du jour en annexe (il est parmi les choix), aucun non prévenu, le délégué titulaire (avec compte) seul en annexe : le suppléant sans compte, non',
    pg_temp.appeler('stag_n', '1', format(c_apercu, f_form_n, '[{"jour":"2026-11-19","demi":"matin"}]')),
    'OK choix|true|0|aucun|Preuve14 deleg PREUVE');
  perform pg_temp.attendre('prevenir', 'prevenir_absence sans choix (mode choix) : refusé',
    pg_temp.prevenir('stag_n', '2026-11-19', null, 'matin', null, null, 'sante', 'Preuve14 mot', '{}', null),
    'ERREUR P0001 contact: Choisis au moins une personne à prévenir.');
  v := pg_temp.poser_ab('a1', pg_temp.prevenir('stag_n', '2026-11-19', null, 'matin', null, null, 'sante', 'Preuve14 mot', '{}', format(c_choix, f_form_n)));
  perform pg_temp.verifier('prevenir', 'a1 : stag_n prévient (jeudi 19 matin, santé) en choisissant la fiche de form_n : OK', v ~ '^OK [0-9]+$', v);
  v_id := pg_temp.ab('a1');
  perform pg_temp.attendre('prevenir', 'a1 : form_n seul principal ; aucun formateur du jour en annexe (form_n, au planning, est déjà principal) ; le délégué titulaire en annexe, jamais principal',
    pg_temp.dest_de(v_id), format('%s:P,s%s:delegue', f_form_n, s_deleg));
  perform pg_temp.attendre('prevenir', 'a1 : envois « nouvelle » à form_n, « avis_absence » au délégué',
    pg_temp.envois_de(v_id), format('%s:nouvelle,s%s:avis_absence', f_form_n, s_deleg));
  perform pg_temp.attendre('prevenir', 'a1 : l''absence (jours, moment, motif, cases décochées, stagiaire, promo, justificatif) et sa demande (type, mot dans le texte, aucun sujet, envoyée)',
    pg_temp.calcul(format($ab_q$select concat_ws('|', a.du, a.au, a.quand, coalesce(a.heure_debut, '-'), a.motif, a.annexes_decochees::text, a.stagiaire_id,
        a.promo_id, coalesce(a.justificatif, '-'), d.type, d.texte, coalesce(d.sujet, '-'), d.etat)
      from public.absences_annoncees a join public.demandes d on d.id = a.demande_id where a.demande_id = %s$ab_q$, v_id)),
    format('2026-11-19|2026-11-19|matin|-|sante|{}|%s|1|-|absence|Preuve14 mot|-|envoyee', s_n));
  perform pg_temp.attendre('prevenir', 'le délégué n''a pas de fiche : le choisir est impossible (aucune fiche à son adresse, absent de la liste de choix)',
    concat_ws('|', pg_temp.calcul(format('select count(*)::text from public.contacts where compte_email = %L', pg_temp.email_de('deleg'))),
      pg_temp.appeler('stag_n', '1', $ab_q$select count(*)::text from jsonb_array_elements(public.apercu_envoi('absence', '[{"jour":"2026-11-19","demi":"matin"}]'::jsonb) -> 'possibles') x
        where x ->> 'nom' like '%deleg%'$ab_q$)),
    '0|OK 0');
  v := pg_temp.poser_ab('a2', pg_temp.prevenir('stag_n', '2026-11-20', null, 'matin', null, null, 'transport', null, '{delegue}', format(c_choix, f_form_n)));
  perform pg_temp.attendre('prevenir', 'a2 (vendredi 20 matin, délégué décoché) : l''absence existe ; ni ligne ni envoi pour le délégué ; case décochée gardée',
    concat_ws(' / ', pg_temp.dest_de(pg_temp.ab('a2')), pg_temp.envois_de(pg_temp.ab('a2')),
      pg_temp.calcul(format('select annexes_decochees::text from public.absences_annoncees where demande_id = %s', pg_temp.ab('a2')))),
    format('%1$s:P / %1$s:nouvelle / {delegue}', f_form_n));
  perform pg_temp.attendre('prevenir', 'refus : le mardi 17 (passé), un samedi seul, plus de 31 jours, une plage sur deux jours, un motif inconnu, une case annexe inconnue',
    concat_ws(' / ',
      pg_temp.prevenir('stag_n', '2026-11-17', null, 'matin', null, null, 'sante', null, '{}', format(c_choix, f_form_n)),
      pg_temp.prevenir('stag_n', '2026-11-21', null, 'matin', null, null, 'sante', null, '{}', format(c_choix, f_form_n)),
      pg_temp.prevenir('stag_n', '2026-11-19', '2026-12-20', 'journee', null, null, 'sante', null, '{}', format(c_choix, f_form_n)),
      pg_temp.prevenir('stag_n', '2026-11-19', '2026-11-20', 'heures', '10:00', '11:00', 'sante', null, '{}', format(c_choix, f_form_n)),
      pg_temp.prevenir('stag_n', '2026-11-19', null, 'matin', null, null, 'maladie', null, '{}', format(c_choix, f_form_n)),
      pg_temp.prevenir('stag_n', '2026-11-19', null, 'matin', null, null, 'sante', null, '{direction}', format(c_choix, f_form_n))),
    'ERREUR P0001 contact: Une absence passée se règle avec l''équipe. / ERREUR P0001 contact: Ces jours ne comptent aucune demi-journée de formation (ni le samedi ni le dimanche). / ERREUR P0001 contact: Une absence annoncée couvre 31 jours au plus : au-delà, vois avec l''équipe. / ERREUR P0001 contact: Une absence de quelques heures tient dans une seule journée. / ERREUR P0001 contact: Choisis un motif : santé, transport, démarche, famille ou autre. / ERREUR P0001 contact: Les envois à décocher sont illisibles.');
  perform pg_temp.attendre('prevenir', 'apercu_envoi(absence, jeudi 19 après-midi) : « Karim (fictif) », saisi à la main au planning, parmi les non prévenus',
    pg_temp.appeler('stag_n', '1', format(c_apercu, f_form_n, '[{"jour":"2026-11-19","demi":"aprem"}]')),
    'OK choix|false|0|Karim (fictif)|Preuve14 deleg PREUVE');
  v := pg_temp.poser_ab('a3', pg_temp.prevenir('stag_n', '2026-11-19', null, 'aprem', null, null, 'famille', null, '{}', format(c_choix, f_form_n)));
  perform pg_temp.attendre('prevenir', 'a3 (jeudi 19 après-midi) : la ligne de « Karim (fictif) », annexe sans fiche, non_prevenu porte son nom, sans envoi',
    concat_ws(' / ', pg_temp.dest_de(pg_temp.ab('a3')), pg_temp.envois_de(pg_temp.ab('a3'))),
    format('%1$s:P,n:formateur_du_jour:Karim (fictif),s%2$s:delegue / %1$s:nouvelle,s%2$s:avis_absence', f_form_n, s_deleg));
  v := pg_temp.poser_ab('a4', pg_temp.prevenir('stag_n', '2026-11-19', '2026-11-23', 'journee', null, null, 'demarche', null, '{}', format(c_choix, f_dir_n)));
  perform pg_temp.attendre('prevenir', 'a4 (journée, du jeudi 19 au lundi 23) : six demi-journées dans jours (liste_demandes), samedi et dimanche exclus',
    pg_temp.appeler('stag_n', '1', format($ab_q$select (select string_agg((e ->> 'jour') || ' ' || (e ->> 'demi'), ',' order by o) from jsonb_array_elements(l.jours) with ordinality t(e, o))
      from public.liste_demandes() l where l.id = %s$ab_q$, pg_temp.ab('a4'))),
    'OK 2026-11-19 matin,2026-11-19 aprem,2026-11-20 matin,2026-11-20 aprem,2026-11-23 matin,2026-11-23 aprem');
  perform pg_temp.attendre('prevenir', 'a4 : dir_n choisi ; form_n (formateur du jour, non choisi), « Karim (fictif) » et le délégué en annexe ; avis à form_n et au délégué',
    concat_ws(' / ', pg_temp.dest_de(pg_temp.ab('a4')), pg_temp.envois_de(pg_temp.ab('a4'))),
    format('%1$s:P,n:formateur_du_jour:Karim (fictif),%2$s:formateur_du_jour,s%3$s:delegue / %1$s:nouvelle,%2$s:avis_absence,s%3$s:avis_absence',
      f_dir_n, f_form_n, s_deleg));
  v := pg_temp.poser_ab('a5', pg_temp.prevenir('stag_n', '2026-11-19', null, 'matin', null, null, 'autre', null, '{formateurs}', format(c_choix, f_dir_n)));
  perform pg_temp.attendre('prevenir', 'a5 (jeudi 19 matin, dir_n choisi, formateurs décochés) : form_n, formateur du jour, n''est pas prévenu ; le délégué l''est',
    concat_ws(' / ', pg_temp.dest_de(pg_temp.ab('a5')), pg_temp.envois_de(pg_temp.ab('a5'))),
    format('%1$s:P,s%2$s:delegue / %1$s:nouvelle,s%2$s:avis_absence', f_dir_n, s_deleg));
  -- C-24 : une plage appartient à la demi-journée de son heure de début ; l'après-midi commence à l'heure saisie au planning, sinon à 13:30.
  perform pg_temp.attendre('prevenir', 'C-24 : une plage de 14:00 le jeudi 19 est l''après-midi ; avec un après-midi saisi à 14:30 ce jour-là, le matin',
    concat_ws(' / ', pg_temp.calcul($ab_q$select public._contact_jours_absence(1, date '2026-11-19', date '2026-11-19', 'heures', '14:00')::text$ab_q$),
      pg_temp.essai($ab_q$insert into public.planning_half_meta (promo_id, semaine_lundi, day_index, half_day, start_time, end_time)
        values (1, date '2026-11-16', 3, 'aprem', '14:30', '17:30')$ab_q$),
      pg_temp.calcul($ab_q$select public._contact_jours_absence(1, date '2026-11-19', date '2026-11-19', 'heures', '14:00')::text$ab_q$),
      pg_temp.essai($ab_q$delete from public.planning_half_meta where promo_id = 1 and semaine_lundi = date '2026-11-16' and day_index = 3 and half_day = 'aprem'$ab_q$)),
    '[{"demi": "aprem", "jour": "2026-11-19"}] / OK / [{"demi": "matin", "jour": "2026-11-19"}] / OK');
end $ab_gp$;

-- Groupe delegue : après le groupe prevenir (a1, a3, a4 et a5 l'avisent ; a2 l'a décoché). stag_n annule a3 avant son début.
create or replace function pg_temp.groupe_delegue()
returns void language plpgsql as $ab_gd$
begin
  perform pg_temp.horloge('2026-11-18 18:00');
  perform pg_temp.attendre('delegue', 'stag_n annule a3 (jeudi 19 après-midi) avant son début : OK',
    pg_temp.appeler('stag_n', '1', format('select public.annuler_demande(%s)::text', pg_temp.ab('a3'))), 'OK');
  perform pg_temp.attendre('delegue', 'liste_demandes du délégué : ses avis non annulés (a1, a4, a5), type, nom de stag_n, rôle, jours ; ni identifiant, ni sujet, ni état, ni date, ni indicateur',
    pg_temp.appeler('deleg', '1', $ab_q$select concat_ws('|', count(*), string_agg(distinct type, ','), string_agg(distinct auteur_nom, ','), string_agg(distinct mon_role, ','),
        count(id), count(sujet), count(etat), count(cree_le), count(dernier_echange_le), count(non_lue), count(a_traiter), count(envoi_en_echec), count(jours))
      from public.liste_demandes()$ab_q$),
    'OK 3|absence|Preuve7 stag_n PREUVE|delegue|0|0|0|0|0|0|0|0|3');
  perform pg_temp.attendre('delegue', 'le délégué lit le jour et la demi-journée : jeudi 19 matin (a1 et a5, une demi-journée chacune) ; six demi-journées à partir du jeudi 19 matin (a4)',
    pg_temp.appeler('deleg', '1', $ab_q$select string_agg(jsonb_array_length(jours)::text || ':' || (jours -> 0 ->> 'jour') || ' ' || (jours -> 0 ->> 'demi'), ','
        order by jsonb_array_length(jours)) from public.liste_demandes()$ab_q$),
    'OK 1:2026-11-19 matin,1:2026-11-19 matin,6:2026-11-19 matin');
  perform pg_temp.attendre('delegue', 'demande_detail(a1) par le délégué : refusé',
    pg_temp.appeler('deleg', '1', format('select public.demande_detail(%s)::text', pg_temp.ab('a1'))), 'ERREUR 42501 contact: Demande introuvable.');
  perform pg_temp.attendre('delegue', 'balayage du jsonb de chaque ligne du délégué : ni « sante », ni « demarche », ni le mot de stag_n',
    pg_temp.appeler('deleg', '1', $ab_q$select count(*) || '|' || count(*) filter (where to_jsonb(l)::text like '%sante%' or to_jsonb(l)::text like '%demarche%'
        or to_jsonb(l)::text like '%Preuve14 mot%') from public.liste_demandes() l$ab_q$),
    'OK 3|0');
  perform pg_temp.attendre('delegue', 'contrôle du balayage : demande_detail(a1) par stag_n, lui, porte bien « sante »',
    pg_temp.appeler('stag_n', '1', format($ab_q$select (public.demande_detail(%s)::text like '%%sante%%')::text$ab_q$, pg_temp.ab('a1'))), 'OK true');
end $ab_gd$;

-- Groupe annuler (C-13) : b1 et b2 (jeudi 19 matin, début 09:00 par défaut), b3 (de 10:00 à 11:00), prévenues la veille.
create or replace function pg_temp.groupe_annuler()
returns void language plpgsql as $ab_gn$
declare
  f_form_n text := pg_temp.fiche('form_n');
  s_n text := pg_temp.stag('stag_n');
  s_deleg text := pg_temp.stag('deleg');
  v_choix text := format('array[%s]::bigint[]', pg_temp.fiche('form_n'));
  v_e0 text;
  c_peut constant text := $ab_q$select public.demande_detail(%s) -> 'peut' ->> 'annuler'$ab_q$;
  c_annuler constant text := 'select public.annuler_demande(%s)::text';
  c_etat constant text := $ab_q$select concat_ws('|', etat, annulee_par) from public.demandes where id = %s$ab_q$;
begin
  perform pg_temp.horloge('2026-11-18 18:00');
  perform pg_temp.vider_absences();
  perform pg_temp.poser_ab('b1', pg_temp.prevenir('stag_n', '2026-11-19', null, 'matin', null, null, 'sante', null, '{}', v_choix));
  perform pg_temp.poser_ab('b2', pg_temp.prevenir('stag_n', '2026-11-19', null, 'matin', null, null, 'transport', null, '{}', v_choix));
  perform pg_temp.poser_ab('b3', pg_temp.prevenir('stag_n', '2026-11-19', null, 'heures', '10:00', '11:00', 'demarche', null, '{}', v_choix));
  perform pg_temp.verifier('annuler', 'b1, b2, b3 : prévenues', pg_temp.ab('b1') <> 'null' and pg_temp.ab('b2') <> 'null' and pg_temp.ab('b3') <> 'null',
    concat_ws(' ', pg_temp.ab('b1'), pg_temp.ab('b2'), pg_temp.ab('b3')));
  perform pg_temp.attendre('annuler', 'b3 (de 10:00 à 11:00) : ses jours = le jeudi 19 matin (C-24)',
    pg_temp.calcul(format('select public._contact_jours_demande(%s)::text', pg_temp.ab('b3'))), '[{"demi": "matin", "jour": "2026-11-19"}]');

  perform pg_temp.horloge('2026-11-19 08:59');
  perform pg_temp.attendre('annuler', '08:59 : demande_detail(b1).peut.annuler vrai pour stag_n',
    pg_temp.appeler('stag_n', '1', format(c_peut, pg_temp.ab('b1'))), 'OK true');
  v_e0 := pg_temp.dernier_envoi();
  perform pg_temp.attendre('annuler', '08:59 : stag_n annule b1 : OK', pg_temp.appeler('stag_n', '1', format(c_annuler, pg_temp.ab('b1'))), 'OK');
  perform pg_temp.attendre('annuler', 'b1 annulée par stag_n ; envois : « annulation » à form_n (principal), « annulation_absence » au délégué (annexe)',
    concat_ws(' / ', pg_temp.calcul(format(c_etat, pg_temp.ab('b1'))), pg_temp.envois_apres(pg_temp.ab('b1'), v_e0)),
    format('annulee|Preuve7 stag_n PREUVE / %s:annulation:a_envoyer,s%s:annulation_absence:a_envoyer', f_form_n, s_deleg));

  perform pg_temp.horloge('2026-11-19 09:00');
  perform pg_temp.attendre('annuler', '09:00 : demande_detail(b2).peut.annuler faux pour stag_n, vrai pour form_n',
    pg_temp.appeler('stag_n', '1', format(c_peut, pg_temp.ab('b2'))) || ' / ' || pg_temp.appeler('form_n', '1', format(c_peut, pg_temp.ab('b2'))),
    'OK false / OK true');
  perform pg_temp.attendre('annuler', '09:00 : stag_n annule b2 : refusé',
    pg_temp.appeler('stag_n', '1', format(c_annuler, pg_temp.ab('b2'))), 'ERREUR P0001 contact: L''absence a commencé : demande à l''équipe de la corriger.');
  perform pg_temp.attendre('annuler', 'b2 : ni le délégué, ni un autre stagiaire (stag_h), ni t_rh (direction à titre non fixe, sans le planning) ne l''annulent',
    concat_ws(' / ', pg_temp.appeler('deleg', '1', format(c_annuler, pg_temp.ab('b2'))), pg_temp.appeler('stag_h', '1', format(c_annuler, pg_temp.ab('b2'))),
      pg_temp.appeler('t_rh', '1', format(c_annuler, pg_temp.ab('b2')))),
    'ERREUR 42501 contact: Demande introuvable. / ERREUR 42501 contact: Demande introuvable. / ERREUR 42501 contact: Demande introuvable.');
  v_e0 := pg_temp.dernier_envoi();
  perform pg_temp.attendre('annuler', '09:00 : form_n annule b2 : OK', pg_temp.appeler('form_n', '1', format(c_annuler, pg_temp.ab('b2'))), 'OK');
  perform pg_temp.attendre('annuler', 'b2 annulée par form_n ; envois : « annulation_absence » au délégué, « annulation » à stag_n (l''auteur) ; rien à form_n, qui annule',
    concat_ws(' / ', pg_temp.calcul(format(c_etat, pg_temp.ab('b2'))), pg_temp.envois_apres(pg_temp.ab('b2'), v_e0)),
    format('annulee|Preuve14 form_n / s%s:annulation_absence:a_envoyer,s%s:annulation:a_envoyer', s_deleg, s_n));
  perform pg_temp.attendre('annuler', 'b1 annulée une seconde fois (form_n) : refusé ; une demande annulée ne peut plus s''annuler pour personne (peut.annuler faux)',
    pg_temp.appeler('form_n', '1', format(c_annuler, pg_temp.ab('b1'))) || ' / ' || pg_temp.appeler('form_n', '1', format(c_peut, pg_temp.ab('b1'))),
    'ERREUR P0001 contact: Cette absence est déjà annulée. / OK false');

  perform pg_temp.horloge('2026-11-19 10:00');
  perform pg_temp.attendre('annuler', '10:00 : b3 (de 10:00 à 11:00) a commencé : peut.annuler faux pour stag_n, annulation refusée',
    pg_temp.appeler('stag_n', '1', format(c_peut, pg_temp.ab('b3'))) || ' / ' || pg_temp.appeler('stag_n', '1', format(c_annuler, pg_temp.ab('b3'))),
    'OK false / ERREUR P0001 contact: L''absence a commencé : demande à l''équipe de la corriger.');
  perform pg_temp.horloge('2026-11-19 09:59');
  perform pg_temp.attendre('annuler', '09:59 : b3 annulable par stag_n (peut.annuler vrai), annulée',
    pg_temp.appeler('stag_n', '1', format(c_peut, pg_temp.ab('b3'))) || ' / ' || pg_temp.appeler('stag_n', '1', format(c_annuler, pg_temp.ab('b3'))),
    'OK true / OK');
end $ab_gn$;

-- Groupe justificatif : j1 (jeudi 19 matin, santé, un mot), prévenue la veille, form_n choisi.
create or replace function pg_temp.groupe_justificatif()
returns void language plpgsql as $ab_gj$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  f_form_n text := pg_temp.fiche('form_n');
  f_dir_n text := pg_temp.fiche('dir_n');
  s_n text := pg_temp.stag('stag_n');
  s_deleg text := pg_temp.stag('deleg');
  h_justif constant text := repeat('a7', 32);
  h_dir constant text := repeat('b8', 32);
  v_rep text;
  v_e0 text;
  j1 text;
  r jsonb;
  c_regler constant text := 'select public.regler_justificatif(%s, %L)::text';
  c_etat constant text := $ab_q$select concat_ws('|', coalesce(a.justificatif, '-'), d.etat) from public.absences_annoncees a join public.demandes d on d.id = a.demande_id
      where a.demande_id = %s$ab_q$;
begin
  perform pg_temp.horloge('2026-11-18 18:00');
  perform pg_temp.vider_absences();
  perform pg_temp.essai($ab_q$update public.contact_envois set etat = 'envoye' where etat in ('a_envoyer', 'a_retenter', 'en_cours')$ab_q$);
  perform pg_temp.poser_ab('j1', pg_temp.prevenir('stag_n', '2026-11-19', null, 'matin', null, null, 'sante', 'Preuve14 mot du lien', '{}',
                                                  format('array[%s]::bigint[]', f_form_n)));
  j1 := pg_temp.ab('j1');
  -- La file des envois (service_role) : les jours de l'absence, jamais le motif ni le mot.
  r := pg_temp.srv('select public._contact_srv_prendre(20)');
  perform pg_temp.attendre('justificatif', '_contact_srv_prendre : l''envoi à form_n et l''avis au délégué portent le type et les jours (jeudi 19 matin) ; ni motif ni mot dans tout le rendu',
    concat_ws(' | ',
      (select string_agg(concat_ws(':', case when (x -> 'destinataire' ->> 'stagiaire')::boolean then 'stagiaire' else 'fiche' end, x ->> 'evenement',
                                   x -> 'demande' ->> 'type', x -> 'demande' -> 'jours'), ',' order by x ->> 'envoi_id')
         from jsonb_array_elements(case when jsonb_typeof(r) = 'array' then r else '[]'::jsonb end) x),
      (r::text like '%sante%' or r::text like '%Preuve14 mot du lien%')::text),
    'fiche:nouvelle:absence:[{"demi": "matin", "jour": "2026-11-19"}],stagiaire:avis_absence:absence:[{"demi": "matin", "jour": "2026-11-19"}] | false');
  perform pg_temp.attendre('justificatif', 'mes_justificatifs_a_remettre par stag_n avant toute réponse : rien',
    pg_temp.appeler('stag_n', '1', 'select count(*)::text from public.mes_justificatifs_a_remettre()'), 'OK 0');
  -- La réponse toute faite qui demande le justificatif.
  v_rep := pg_temp.calcul(format($ab_q$select id::text from public.contact_reponses where lieu_id = %s and demande_justificatif and not retire order by ordre, id limit 1$ab_q$, v_l1));
  perform pg_temp.attendre('justificatif', 'form_n répond « Absence enregistrée, pense à remettre ton justificatif » : le justificatif passe « à remettre », la demande est prise',
    pg_temp.appeler('form_n', '1', format('select (public.repondre_demande(%s, null, %s) is not null)::text', j1, v_rep)) || ' / ' || pg_temp.calcul(format(c_etat, j1)),
    'OK true / a_remettre|prise');
  perform pg_temp.attendre('justificatif', 'mes_justificatifs_a_remettre : j1 (jeudi 19, matin) pour stag_n ; rien pour form_n (pas un stagiaire)',
    pg_temp.appeler('stag_n', '1', $ab_q$select string_agg(concat_ws('|', demande_id, du, au, quand, coalesce(debut, '-'), coalesce(fin, '-')), ',') from public.mes_justificatifs_a_remettre()$ab_q$)
      || ' / ' || pg_temp.appeler('form_n', '1', 'select count(*)::text from public.mes_justificatifs_a_remettre()'),
    format('OK %s|2026-11-19|2026-11-19|matin|-|- / OK 0', j1));
  perform pg_temp.attendre('justificatif', 'demande_detail(j1) : peut.justificatif vrai pour stag_n (l''envoyer) et pour form_n (le régler) ; form_n lit l''absence (moment, motif, mot, justificatif)',
    pg_temp.appeler('stag_n', '1', format($ab_q$select public.demande_detail(%s) -> 'peut' ->> 'justificatif'$ab_q$, j1)) || ' / '
      || pg_temp.appeler('form_n', '1', format($ab_q$select concat_ws('|', r -> 'peut' ->> 'justificatif', r -> 'absence' ->> 'quand', r -> 'absence' ->> 'motif', r -> 'absence' ->> 'mot',
           r -> 'absence' ->> 'justificatif') from (select public.demande_detail(%s) r) x$ab_q$, j1)),
    'OK true / OK true|matin|sante|Preuve14 mot du lien|a_remettre');
  perform pg_temp.attendre('justificatif', 'regler_justificatif par stag_n (l''auteur), par le délégué, par t_rh (sans rôle) : refusés ; un état inconnu (form_n) : refusé',
    concat_ws(' / ', pg_temp.appeler('stag_n', '1', format(c_regler, j1, 'recu')), pg_temp.appeler('deleg', '1', format(c_regler, j1, 'recu')),
      pg_temp.appeler('t_rh', '1', format(c_regler, j1, 'recu')), pg_temp.appeler('form_n', '1', format(c_regler, j1, 'perdu'))),
    'ERREUR 42501 contact: Le justificatif se règle par l''équipe du centre. / ERREUR 42501 contact: Demande introuvable. / ERREUR 42501 contact: Demande introuvable. / ERREUR P0001 contact: État du justificatif inconnu.');
  perform pg_temp.attendre('justificatif', 'siege_form (formateur à titre fixe de la promo, non destinataire) remet le justificatif à nul : OK',
    pg_temp.appeler('siege_form', '1', format('select public.regler_justificatif(%s, null)::text', j1)) || ' / ' || pg_temp.calcul(format(c_etat, j1)),
    'OK / -|prise');
  -- Le lien d'e-mail « Justificatif reçu » (jeton posé en propriétaire pour la fiche de form_n, principal ; un autre pour dir_n, qui ne l'est pas).
  perform pg_temp.essai(format($ab_q$insert into public.contact_jetons (hash, demande_id, fiche_id, action, expire_le) values
      (decode(%L, 'hex'), %s, %s, 'justificatif', timestamptz '2026-12-31 12:00 Europe/Paris'),
      (decode(%L, 'hex'), %s, %s, 'justificatif', timestamptz '2026-12-31 12:00 Europe/Paris')$ab_q$, h_justif, j1, f_form_n, h_dir, j1, f_dir_n));
  r := pg_temp.srv(format('select public._contact_srv_lien(%L)', h_justif));
  perform pg_temp.attendre('justificatif', '_contact_srv_lien (justificatif) : le motif, le mot, les jours et le moment de l''absence ; pas encore fait',
    concat_ws('|', r ->> 'action', r -> 'demande' ->> 'motif', r -> 'demande' ->> 'mot', r -> 'demande' -> 'jours', r -> 'demande' -> 'moment' ->> 'quand',
      r -> 'demande' -> 'moment' ->> 'du', r ->> 'deja'),
    'justificatif|sante|Preuve14 mot du lien|[{"demi": "matin", "jour": "2026-11-19"}]|matin|2026-11-19|false');
  v_e0 := pg_temp.dernier_envoi();
  perform pg_temp.attendre('justificatif', '_contact_srv_agir (justificatif, form_n) : fait ; justificatif reçu ; envoi « justificatif_recu » à stag_n',
    concat_ws(' / ', pg_temp.srv(format('select public._contact_srv_agir(%L)', h_justif))::text, pg_temp.calcul(format(c_etat, j1)), pg_temp.envois_apres(j1, v_e0)),
    format('{"fait": true} / recu|prise / s%s:justificatif_recu:a_envoyer', s_n));
  perform pg_temp.attendre('justificatif', 'second toucher du même lien : déjà fait, rien d''écrit ; le lien le dit ; le jeton de dir_n (non principal) : déjà fait aussi (justificatif reçu)',
    concat_ws(' / ', pg_temp.srv(format('select public._contact_srv_agir(%L)', h_justif))::text,
      pg_temp.srv(format('select public._contact_srv_lien(%L)', h_justif)) ->> 'deja', pg_temp.envois_apres(j1, v_e0),
      pg_temp.srv(format('select public._contact_srv_agir(%L)', h_dir))::text),
    format('{"deja": true} / true / s%s:justificatif_recu:a_envoyer / {"deja": true}', s_n));
  perform pg_temp.attendre('justificatif', 'justificatif remis à nul (form_n), le jeton de dir_n (direction jamais reconnue par un lien, non principal) : invalide, rien d''écrit',
    pg_temp.appeler('form_n', '1', format('select public.regler_justificatif(%s, null)::text', j1)) || ' / '
      || pg_temp.srv(format('select public._contact_srv_agir(%L)', h_dir))::text || ' / ' || pg_temp.calcul(format(c_etat, j1)),
    'OK / {"invalide": true} / -|prise');
  perform pg_temp.attendre('justificatif', 'reçu par form_n dans l''app : peut.justificatif de stag_n devient faux (rien à envoyer)',
    pg_temp.appeler('form_n', '1', format(c_regler, j1, 'recu')) || ' / '
      || pg_temp.appeler('stag_n', '1', format($ab_q$select public.demande_detail(%s) -> 'peut' ->> 'justificatif'$ab_q$, j1)),
    'OK / OK false');
end $ab_gj$;

-- Groupe emargement : la feuille du jeudi 19 matin, ouverte par form_n à 08:30. e1 : stag_n (matin) ; e2 : stag_h (de 10:00 à 11:00),
-- prévenues la veille ; e3 : stag_k, prévenue après l'ouverture ; e4 : stag_o, après une observation du formateur.
create or replace function pg_temp.groupe_emargement()
returns void language plpgsql as $ab_ge$
declare
  v_choix text := format('array[%s]::bigint[]', pg_temp.fiche('form_n'));
  s_n text := pg_temp.stag('stag_n');
  s_h text := pg_temp.stag('stag_h');
  s_o text := pg_temp.stag('stag_o');
  v_jour_def text;
  v_seance text;
  v text;
  c_trace constant text := 'M1 1L2 2';
  c_annuler constant text := 'select public.annuler_demande(%s)::text';
  c_regler constant text := 'select public.regler_justificatif(%s, %L)::text';
begin
  perform pg_temp.horloge('2026-11-18 18:00');
  perform pg_temp.vider_absences();
  -- L'émargement allumé pour la promo 1 ; le jour de l'émargement lit l'horloge de la preuve le temps du groupe (définition rendue à la fin).
  v_jour_def := pg_temp.calcul($ab_q$select pg_get_functiondef('public.emargement_jour_paris()'::regprocedure)$ab_q$);
  perform pg_temp.essai($ab_q$delete from public.settings where promo_id = 1 and key = 'emargement_actif'$ab_q$);
  perform pg_temp.essai($ab_q$insert into public.settings (key, value, promo_id) values ('emargement_actif', 'true', 1)$ab_q$);
  perform pg_temp.essai($ab_q$create or replace function public.emargement_jour_paris() returns date language sql stable set search_path = public, pg_temp
    as 'select (coalesce(nullif(current_setting(''preuve.maintenant'', true), '''')::timestamptz, now()) at time zone ''Europe/Paris'')::date'$ab_q$);
  perform pg_temp.poser_ab('e1', pg_temp.prevenir('stag_n', '2026-11-19', null, 'matin', null, null, 'sante', null, '{}', v_choix));
  perform pg_temp.poser_ab('e2', pg_temp.prevenir('stag_h', '2026-11-19', null, 'heures', '10:00', '11:00', 'transport', null, '{}', v_choix));
  perform pg_temp.verifier('emargement', 'e1 (stag_n, jeudi 19 matin) et e2 (stag_h, de 10:00 à 11:00) : prévenues la veille',
    pg_temp.ab('e1') <> 'null' and pg_temp.ab('e2') <> 'null', pg_temp.ab('e1') || ' ' || pg_temp.ab('e2'));

  perform pg_temp.horloge('2026-11-19 08:30');
  v := pg_temp.appeler('form_n', '1', $ab_q$select public.emargement_ouvrir('matin', '09:00', '12:00')::text$ab_q$);
  perform pg_temp.verifier('emargement', 'form_n ouvre la feuille du jeudi 19 matin (émargement allumé en propriétaire)', v ~ '^OK [0-9]+$', v);
  v_seance := pg_temp.id_rendu(v);
  perform pg_temp.attendre('emargement', 'à l''ouverture : stag_n absent, origine annoncee, « Absence prévenue »',
    pg_temp.ligne(v_seance, 'stag_n'), 'true|annoncee|Absence prévenue|false');
  perform pg_temp.attendre('emargement', 'à l''ouverture : stag_h (de 10:00 à 11:00) non absent, seulement l''observation « Absent de 10 h à 11 h, prévenu »',
    pg_temp.ligne(v_seance, 'stag_h'), 'false|-|Absent de 10 h à 11 h, prévenu|false');
  perform pg_temp.attendre('emargement', 'stag_n tente de signer : refus d''origine (noté absent)',
    pg_temp.appeler('stag_n', '1', format('select public.emargement_signer(%s, %s, %L)::text', v_seance, s_n, c_trace)),
    'ERREUR P0001 emargement: Noté absent : un formateur doit d''abord retirer l''absence.');
  perform pg_temp.attendre('emargement', 'justificatif de e1 reçu (form_n) : « Absence justifiée », toujours absent',
    pg_temp.appeler('form_n', '1', format(c_regler, pg_temp.ab('e1'), 'recu')) || ' / ' || pg_temp.ligne(v_seance, 'stag_n'),
    'OK / true|annoncee|Absence justifiée|false');
  v := pg_temp.appeler('stag_h', '1', format('select public.emargement_signer(%s, %s, %L)::text', v_seance, s_h, c_trace));
  perform pg_temp.verifier('emargement', 'stag_h signe à son arrivée (sa plage ne couvre pas la demi-journée)', v like 'OK %', v);
  perform pg_temp.attendre('emargement', 'stag_h : ligne signée, observation gardée', pg_temp.ligne(v_seance, 'stag_h'), 'false|-|Absent de 10 h à 11 h, prévenu|true');
  perform pg_temp.attendre('emargement', 'form_n écrit une observation sur la ligne de stag_o (aucune absence annoncée encore)',
    pg_temp.appeler('form_n', '1', format('select public.emargement_annoter(%s, %s, null, %L)::text', v_seance, s_o, 'Preuve14 observation du formateur'))
      || ' / ' || pg_temp.ligne(v_seance, 'stag_o'),
    'OK / false|-|Preuve14 observation du formateur|false');

  perform pg_temp.horloge('2026-11-19 08:40');
  perform pg_temp.poser_ab('e3', pg_temp.prevenir('stag_k', '2026-11-19', null, 'matin', null, null, 'famille', null, '{}', v_choix));
  perform pg_temp.attendre('emargement', 'e3 : stag_k prévient après l''ouverture : sa ligne est marquée à l''instant',
    pg_temp.ligne(v_seance, 'stag_k'), 'true|annoncee|Absence prévenue|false');
  perform pg_temp.attendre('emargement', 'e3 : la ligne marquée ne porte l''adresse de personne (maj_par nul, jamais celle du stagiaire qui a prévenu)',
    pg_temp.calcul(format('select coalesce(maj_par, ''nul'') from public.emargement_lignes where seance_id = %s and stagiaire_id = %s', v_seance, pg_temp.stag('stag_k'))), 'nul');
  perform pg_temp.poser_ab('e4', pg_temp.prevenir('stag_o', '2026-11-19', null, 'journee', null, null, 'autre', null, '{}', v_choix));
  perform pg_temp.attendre('emargement', 'e4 : stag_o prévient après l''observation du formateur : absent, origine annoncee, l''observation du formateur gardée',
    pg_temp.ligne(v_seance, 'stag_o'), 'true|annoncee|Preuve14 observation du formateur|false');
  perform pg_temp.attendre('emargement', 'justificatif de e4 reçu : l''observation du formateur n''est pas remplacée',
    pg_temp.appeler('form_n', '1', format(c_regler, pg_temp.ab('e4'), 'recu')) || ' / ' || pg_temp.ligne(v_seance, 'stag_o'),
    'OK / true|annoncee|Preuve14 observation du formateur|false');
  perform pg_temp.attendre('emargement', 'form_n annule e3 : la ligne de stag_k est rendue (plus d''absence ni d''observation : la ligne vide disparaît)',
    pg_temp.appeler('form_n', '1', format(c_annuler, pg_temp.ab('e3'))) || ' / ' || pg_temp.ligne(v_seance, 'stag_k'), 'OK / aucune ligne');
  perform pg_temp.attendre('emargement', 'form_n annule e2 : la ligne signée de stag_h n''est pas touchée',
    pg_temp.appeler('form_n', '1', format(c_annuler, pg_temp.ab('e2'))) || ' / ' || pg_temp.ligne(v_seance, 'stag_h'),
    'OK / false|-|Absent de 10 h à 11 h, prévenu|true');

  v := pg_temp.appeler('form_n', '1', format('select public.emargement_signer_formateur(%s, %L, %L)::text', v_seance, 'Preuve14 form_n', c_trace));
  perform pg_temp.verifier('emargement', 'form_n signe la feuille', v like 'OK %', v);
  v := pg_temp.appeler('form_n', '1', format('select public.emargement_clore(%s)::text', v_seance));
  perform pg_temp.verifier('emargement', 'emargement_clore : OK', v ~ '^OK [0-9]+$', v);
  perform pg_temp.attendre('emargement', 'après emargement_clore : stag_n et stag_o restent absents, origine annoncee, observations gardées',
    pg_temp.ligne(v_seance, 'stag_n') || ' / ' || pg_temp.ligne(v_seance, 'stag_o'),
    'true|annoncee|Absence justifiée|false / true|annoncee|Preuve14 observation du formateur|false');
  perform pg_temp.attendre('emargement', 'emargement_rouvrir (le jour même) : OK ; les lignes annoncee restent, observations gardées ; stag_h signé, intact',
    concat_ws(' / ', pg_temp.appeler('form_n', '1', format('select public.emargement_rouvrir(%s)::text', v_seance)), pg_temp.ligne(v_seance, 'stag_n'),
      pg_temp.ligne(v_seance, 'stag_o'), pg_temp.ligne(v_seance, 'stag_h')),
    'OK / true|annoncee|Absence justifiée|false / true|annoncee|Preuve14 observation du formateur|false / false|-|Absent de 10 h à 11 h, prévenu|true');
  -- Ménage : la feuille (et ses lignes) supprimée, le jour de l'émargement rendu.
  perform pg_temp.essai(format('delete from public.emargement_seances where id = %s', v_seance));
  perform pg_temp.essai(v_jour_def);
  perform pg_temp.attendre('emargement', 'ménage : feuille d''essai supprimée, emargement_jour_paris rendu à sa définition',
    pg_temp.calcul(format($ab_q$select concat_ws('|', (select count(*) from public.emargement_seances where id = %s),
        (md5(pg_get_functiondef('public.emargement_jour_paris()'::regprocedure)) = md5(%L))::text)$ab_q$, v_seance, v_jour_def)),
    '0|true');
end $ab_ge$;

-- Groupe planning : la semaine du lundi 16 novembre 2026 ; p1 : stag_n, jeudi 19 matin ; p2 : stag_n, vendredi 20 matin, annulée ; p3 :
-- stag_h, jeudi 19 de 10:00 à 11:00.
create or replace function pg_temp.groupe_planning()
returns void language plpgsql as $ab_gl$
declare
  v_choix text := format('array[%s]::bigint[]', pg_temp.fiche('form_n'));
  s_n text := pg_temp.stag('stag_n');
  s_h text := pg_temp.stag('stag_h');
  c_sem constant text := $ab_q$select coalesce(string_agg(concat_ws('|', stagiaire_id, day_index, half_day, entiere::text, coalesce(debut, '-'), coalesce(fin, '-')), ','
      order by stagiaire_id, day_index, half_day desc), 'aucune') from public.absences_annoncees_semaine(date %L) where stagiaire_id in (%s, %s)$ab_q$;
  v_attendu text;
begin
  perform pg_temp.horloge('2026-11-18 18:00');
  perform pg_temp.vider_absences();
  perform pg_temp.poser_ab('p1', pg_temp.prevenir('stag_n', '2026-11-19', null, 'matin', null, null, 'sante', null, '{}', v_choix));
  perform pg_temp.poser_ab('p2', pg_temp.prevenir('stag_n', '2026-11-20', null, 'matin', null, null, 'sante', null, '{}', v_choix));
  perform pg_temp.poser_ab('p3', pg_temp.prevenir('stag_h', '2026-11-19', null, 'heures', '10:00', '11:00', 'transport', null, '{}', v_choix));
  perform pg_temp.attendre('planning', 'p1, p2, p3 prévenues ; p2 annulée par stag_n avant son début',
    concat_ws(' ', (pg_temp.ab('p1') <> 'null' and pg_temp.ab('p2') <> 'null' and pg_temp.ab('p3') <> 'null')::text,
      pg_temp.appeler('stag_n', '1', format('select public.annuler_demande(%s)::text', pg_temp.ab('p2')))),
    'true OK');
  v_attendu := format('OK %s|3|matin|true|-|-,%s|3|matin|false|10:00|11:00', s_n, s_h);
  perform pg_temp.attendre('planning', 'stag_m (promo 2, en-tête 2) : aucune ligne de la promo 1',
    pg_temp.appeler('stag_m', '2', $ab_q$select count(*)::text from public.absences_annoncees_semaine(date '2026-11-16')$ab_q$), 'OK 0');
  perform pg_temp.attendre('planning', 'deleg (stagiaire de la promo 1) : le jeudi matin de stag_n (entière) et la plage de stag_h ; l''absence annulée (vendredi) n''y est pas',
    pg_temp.appeler('deleg', '1', format(c_sem, '2026-11-16', s_n, s_h)), v_attendu);
  perform pg_temp.attendre('planning', 'aucune colonne ne porte le motif (balayage du jsonb de chaque ligne)',
    pg_temp.appeler('deleg', '1', $ab_q$select count(*) || '|' || count(*) filter (where to_jsonb(x)::text like '%sante%' or to_jsonb(x)::text like '%transport%')
      from public.absences_annoncees_semaine(date '2026-11-16') x$ab_q$),
    'OK 2|0');
  perform pg_temp.attendre('planning', 't_rh (direction de Nîmes à titre non fixe, sans le planning) : aucune ligne',
    pg_temp.appeler('t_rh', '1', $ab_q$select count(*)::text from public.absences_annoncees_semaine(date '2026-11-16')$ab_q$), 'OK 0');
  perform pg_temp.attendre('planning', 'form_n (lit le planning) : les mêmes lignes, un mercredi donné valant son lundi',
    pg_temp.appeler('form_n', '1', format(c_sem, '2026-11-18', s_n, s_h)), v_attendu);
end $ab_gl$;

-- Groupe conservation : c1 (stag_n, jeudi 19 matin, santé, un mot), une réponse de form_n, justificatif à remettre.
create or replace function pg_temp.groupe_conservation()
returns void language plpgsql as $ab_gc$
declare
  s_n text := pg_temp.stag('stag_n');
  c1 text;
  v text;
  c_ligne constant text := $ab_q$select concat_ws('|', a.du, a.quand, coalesce(a.motif, '-'), coalesce(a.justificatif, '-'), a.promo_id, coalesce(d.texte, '-'),
      (select count(*) from public.demande_messages m where m.demande_id = a.demande_id)) from public.absences_annoncees a join public.demandes d on d.id = a.demande_id
      where a.demande_id = %s$ab_q$;
begin
  perform pg_temp.horloge('2026-11-18 18:00');
  perform pg_temp.vider_absences();
  perform pg_temp.poser_ab('c1', pg_temp.prevenir('stag_n', '2026-11-19', null, 'matin', null, null, 'sante', 'Preuve14 mot à effacer', '{}',
                                                  format('array[%s]::bigint[]', pg_temp.fiche('form_n'))));
  c1 := pg_temp.ab('c1');
  perform pg_temp.attendre('conservation', 'c1 prévenue ; form_n répond et demande le justificatif',
    concat_ws(' / ', (c1 <> 'null')::text,
      pg_temp.appeler('form_n', '1', format('select (public.repondre_demande(%s, %L) is not null)::text', c1, 'Preuve14 réponse du formateur')),
      pg_temp.appeler('form_n', '1', format('select public.regler_justificatif(%s, %L)::text', c1, 'a_remettre')),
      pg_temp.calcul(format(c_ligne, c1))),
    'true / OK true / OK / 2026-11-19|matin|sante|a_remettre|1|Preuve14 mot à effacer|1');
  perform pg_temp.essai(format('update public.stagiaires set promo_id = 2 where id = %s', s_n));
  perform pg_temp.attendre('conservation', 'stag_n passé dans la promo 2 : son absence garde promo_id 1 et reste au planning de la promo 1 (lu par deleg)',
    pg_temp.calcul(format('select promo_id::text from public.absences_annoncees where demande_id = %s', c1)) || ' / '
      || pg_temp.appeler('deleg', '1', format($ab_q$select count(*)::text from public.absences_annoncees_semaine(date '2026-11-16') where stagiaire_id = %s$ab_q$, s_n)),
    '1 / OK 1');
  perform pg_temp.essai(format('update public.stagiaires set promo_id = 1 where id = %s', s_n));
  -- Étape 1 de l'effacement (_effacer_etape1, que effacer_sur_demande joue d'abord) : la fiche est effacée, pas encore rendue anonyme.
  v := pg_temp.calcul(format('select (public._effacer_etape1(%s) is not null)::text', s_n));
  perform pg_temp.attendre('conservation', 'effacement, étape 1 : la ligne d''absence reste (jour, moment, motif, justificatif) ; le mot et les réponses de sa demande disparaissent',
    v || ' / ' || pg_temp.calcul(format(c_ligne, c1)), 'true / 2026-11-19|matin|sante|a_remettre|1|-|0');
  v := pg_temp.appeler('fond', '1', format('select public.effacer_sur_demande(%s)::text', s_n));
  perform pg_temp.verifier('conservation', 'effacer_sur_demande(stag_n) par le fondateur (étape 2 : la fiche rendue anonyme) : OK', v like 'OK %', left(v, 200));
  perform pg_temp.attendre('conservation', 'après l''anonymisation : motif nul ; la ligne reste (jour, moment, justificatif, promo)',
    pg_temp.calcul(format(c_ligne, c1)) || ' / ' || pg_temp.calcul(format('select (anonymise_le is not null)::text from public.stagiaires where id = %s', s_n)),
    '2026-11-19|matin|-|a_remettre|1|-|0 / true');
end $ab_gc$;

-- Un groupe se joue-t-il dans ce mode ? Contre-épreuve : toujours (il doit être rouge). En ligne : seulement si p_condition (la
-- migration qui le fonde est appliquée), sinon une ligne d'information. Migrations injectées : toujours.
create or replace function pg_temp.groupe_a_jouer(p_groupe text, p_mode text, p_condition boolean, p_raison text)
returns boolean language plpgsql as $ab_gj2$
begin
  if p_mode like 'contact-3-en-ligne%' and not coalesce(p_condition, false) then
    perform pg_temp.informer('groupe ' || p_groupe, 'sauté : ' || p_raison || ' (mode en ligne)');
    return false;
  end if;
  return true;
end $ab_gj2$;

do $tpc3$
declare
  v_mode constant text :=
-- @@MODE@@
  ;
  v_debut constant timestamptz := clock_timestamp();
  v_en_ligne boolean;
  v_m3 text;
  v_r3 text;
  v_etat1 text; v_etat1b text; v_etat2 text; v_etat3 text; v_retour3 text; v_retour2 text; v_retour1b text; v_retour1 text;
  v_av_regles text; v_av_fonctions text; v_av_droits text;
  v_ap_regles text; v_ap_fonctions text; v_ap_droits text;
  v_a3_regles text; v_a3_fonctions text; v_a3_droits text;
  v_r3_regles text; v_r3_fonctions text; v_r3_droits text;
  v_md5_avant3 text; v_md5_apres3 text; v_md5_retour3 text;
  v_seance bigint;
  v_jouees integer;
  v_partie3 boolean;
begin
  perform set_config('lock_timeout', '3s', true);
  v_en_ligne := v_mode like 'contact-3-en-ligne%';

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

  -- 2. Les personnages, posés AVANT les migrations (comme les comptes de la production) : ceux du lot 4, des titres et la fiche sec_n.
  perform pg_temp.poser_contact();
  perform pg_temp.attendre('structure', 'les personnages sont posés (16 du lot 4, 5 des titres, la fiche sans compte sec_n)',
    pg_temp.calcul($q$select concat_ws('/',
      (select count(*) from perso where ordre between 1 and 16)::text,
      (select count(*) from perso where ordre between 20 and 24)::text,
      (select count(*) from perso p join public.contacts c on c.id = p.info::bigint
         where p.nom = 'sec_n' and c.email = 'preuve.sec@exemple.invalid' and c.prenom = 'Preuve Secrétariat'
           and c.lieu_id = (select lieu_id from public.promos where id = 1))::text)$q$),
    '16/5/1');

  -- 3. Les migrations, dans l'ordre d'application (neutralisées dans les modes sans elles).
  v_etat1 := pg_temp.jouer('migration 1',
-- @@INJECTER supabase/migrations/20261115_contact_1_annuaire.sql@@
  );
  perform pg_temp.etape('migration 1', v_etat1, v_mode);
  v_etat1b := pg_temp.jouer('migration 1b',
-- @@INJECTER supabase/migrations/20261115_contact_1b_fermeture.sql@@
  );
  perform pg_temp.etape('migration 1b', v_etat1b, v_mode);
  v_etat2 := pg_temp.jouer('migration 2',
-- @@INJECTER supabase/migrations/20261115_contact_2_demandes.sql@@
  );
  perform pg_temp.etape('migration 2', v_etat2, v_mode);
  -- L'horloge de la preuve (C-21) : _contact_maintenant() lit preuve.maintenant (annulé avec le reste). Posée avant le relevé « avant 3 ».
  if to_regprocedure('public._contact_maintenant()') is not null then
    execute $q$create or replace function public._contact_maintenant() returns timestamptz language sql stable security definer
      set search_path = public, pg_temp as 'select coalesce(nullif(current_setting(''preuve.maintenant'', true), '''')::timestamptz, now())'$q$;
  end if;
  select e.regles, e.fonctions, e.droits into v_a3_regles, v_a3_fonctions, v_a3_droits from pg_temp.empreinte() e;
  v_md5_avant3 := pg_temp.md5_huit();
  v_m3 :=
-- @@INJECTER supabase/migrations/20261115_contact_3_absences.sql@@
  ;
  v_etat3 := pg_temp.jouer('migration 3', v_m3);
  perform pg_temp.etape('migration 3', v_etat3, v_mode);
  v_md5_apres3 := pg_temp.md5_huit();

  -- 4. GROUPES de contrôles de la partie 3, chacun sauté avec une ligne d'information quand la migration 3 n'est pas encore appliquée
  --    (mode en ligne) ; dans la contre-épreuve, ils se jouent et doivent être rouges.
  perform pg_temp.poser_cles();
  perform pg_temp.poser_absences();
  v_partie3 := to_regclass('public.absences_annoncees') is not null;
  if pg_temp.groupe_a_jouer('prevenir', v_mode, v_partie3, 'la migration 3 n''est pas appliquée') then
    perform pg_temp.groupe_prevenir();
  end if;
  if pg_temp.groupe_a_jouer('delegue', v_mode, v_partie3, 'la migration 3 n''est pas appliquée') then
    perform pg_temp.groupe_delegue();
  end if;
  if pg_temp.groupe_a_jouer('annuler', v_mode, v_partie3, 'la migration 3 n''est pas appliquée') then
    perform pg_temp.groupe_annuler();
  end if;
  if pg_temp.groupe_a_jouer('justificatif', v_mode, v_partie3, 'la migration 3 n''est pas appliquée') then
    perform pg_temp.groupe_justificatif();
  end if;
  if pg_temp.groupe_a_jouer('emargement', v_mode, v_partie3, 'la migration 3 n''est pas appliquée') then
    perform pg_temp.groupe_emargement();
  end if;
  if pg_temp.groupe_a_jouer('planning', v_mode, v_partie3, 'la migration 3 n''est pas appliquée') then
    perform pg_temp.groupe_planning();
  end if;
  if pg_temp.groupe_a_jouer('conservation', v_mode, v_partie3, 'la migration 3 n''est pas appliquée') then
    perform pg_temp.groupe_conservation();
  end if;
  perform set_config('preuve.maintenant', '', true);

  -- 5. Les retours, dans l'ordre inverse (3, 2, 1b, 1). Avant le retour 3 : la migration 3 rejouée est refusée ; le retour 3 est refusé
  --    tant qu'une ligne d'émargement a l'origine « annoncee » (posée ici sur une feuille d'essai, puis retirée).
  v_r3 :=
-- @@INJECTER supabase/migrations/20261115_contact_3_absences_retour.sql@@
  ;
  if v_m3 = 'select 1' or v_en_ligne then
    perform pg_temp.informer('retour', 'migration 3 rejouée et garde du retour 3 : non jugeables (migration 3 non injectée)');
    if not v_en_ligne then
      perform pg_temp.verifier('retour', 'la migration 3 est injectée (contre-épreuve : non)', false, v_mode);
    end if;
  else
    perform pg_temp.attendre('retour', 'migration 3 rejouée : refusée par sa garde, rien n''est changé',
      pg_temp.essayer_et_annuler(v_m3),
      'refusée P0001 contact_3 : une table ou une fonction de la migration 3 existe déjà, migration déjà appliquée ? rien n''est changé');
    begin
      insert into public.emargement_seances (promo_id, jour, demi_journee, debut, fin, ouverte_par)
        values (1, date '2031-01-06', 'matin', '09:00', '12:00', 'preuve') returning id into v_seance;
      insert into public.emargement_lignes (seance_id, promo_id, stagiaire_id, absent, absence_origine, observation)
        values (v_seance, 1, (select min(id) from public.stagiaires where promo_id = 1 and anonymise_le is null), true, 'annoncee', 'Absence prévenue');
      perform pg_temp.attendre('retour', 'retour 3 refusé tant qu''une ligne d''émargement a l''origine « annoncee » (rien n''est changé)',
        pg_temp.essayer_et_annuler(v_r3),
        'refusée P0001 contact_3_retour : 1 ligne(s) d''émargement ont l''origine « annoncee » (absence annoncée) ; la contrainte du 23/10 les refuserait, rien n''est changé');
      delete from public.emargement_seances where id = v_seance;
    exception when others then
      perform pg_temp.verifier('retour', 'garde du retour 3 jugée', false, sqlstate || ' ' || left(sqlerrm, 160));
    end;
  end if;
  v_retour3 := pg_temp.jouer('retour 3', v_r3);
  perform pg_temp.etape('retour 3', v_retour3, v_mode);
  select e.regles, e.fonctions, e.droits into v_r3_regles, v_r3_fonctions, v_r3_droits from pg_temp.empreinte() e;
  v_md5_retour3 := pg_temp.md5_huit();
  if v_en_ligne then
    perform pg_temp.informer('retour 3', format('non jugeable (migrations déjà appliquées) ; md5 des huit fonctions : %s', v_md5_apres3));
  else
    perform pg_temp.verifier('retour', 'la migration 3 redéfinit les huit fonctions (md5 de pg_get_functiondef changé pour chacune)',
      v_md5_apres3 <> v_md5_avant3
        and (select bool_and(a.v <> b.v) from unnest(string_to_array(v_md5_avant3, ',')) with ordinality a(v, n)
               join unnest(string_to_array(v_md5_apres3, ',')) with ordinality b(v, n) on a.n = b.n)
        and array_length(string_to_array(v_md5_avant3, ','), 1) = 8,
      'avant ' || v_md5_avant3 || ' ; après ' || v_md5_apres3);
    perform pg_temp.attendre('retour', 'après le retour 3 : md5(pg_get_functiondef) des huit fonctions égal à celui d''avant la migration 3', v_md5_retour3, v_md5_avant3);
    perform pg_temp.attendre('retour', 'après le retour 3 : empreinte regles égale à celle d''avant la migration 3', v_r3_regles, v_a3_regles);
    perform pg_temp.attendre('retour', 'après le retour 3 : empreinte fonctions égale à celle d''avant la migration 3', v_r3_fonctions, v_a3_fonctions);
    perform pg_temp.attendre('retour', 'après le retour 3 : empreinte droits égale à celle d''avant la migration 3', v_r3_droits, v_a3_droits);
  end if;
  v_retour2 := pg_temp.jouer('retour 2',
-- @@INJECTER supabase/migrations/20261115_contact_2_demandes_retour.sql@@
  );
  perform pg_temp.etape('retour 2', v_retour2, v_mode);
  v_retour1b := pg_temp.jouer('retour 1b',
-- @@INJECTER supabase/migrations/20261115_contact_1b_fermeture_retour.sql@@
  );
  perform pg_temp.etape('retour 1b', v_retour1b, v_mode);
  v_retour1 := pg_temp.jouer('retour 1',
-- @@INJECTER supabase/migrations/20261115_contact_1_annuaire_retour.sql@@
  );
  perform pg_temp.etape('retour 1', v_retour1, v_mode);
  select e.regles, e.fonctions, e.droits into v_ap_regles, v_ap_fonctions, v_ap_droits from pg_temp.empreinte() e;
  v_jouees := (v_etat1 = 'jouée')::integer + (v_etat2 = 'jouée')::integer + (v_etat3 = 'jouée')::integer;
  if v_en_ligne or v_jouees = 0 then
    perform pg_temp.informer('retours', format('non jugeables (aucune migration injectée, ou déjà appliquées) ; empreinte du moment : regles %s, fonctions %s, droits %s',
      v_ap_regles, v_ap_fonctions, v_ap_droits));
  else
    perform pg_temp.attendre('retour', 'après les retours : empreinte regles identique à celle d''avant', v_ap_regles, v_av_regles);
    perform pg_temp.attendre('retour', 'après les retours : empreinte fonctions identique à celle d''avant', v_ap_fonctions, v_av_fonctions);
    perform pg_temp.attendre('retour', 'après les retours : empreinte droits identique à celle d''avant', v_ap_droits, v_av_droits);
  end if;
  perform pg_temp.informer('durée du bloc', to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0') || ' s');
  perform pg_temp.verdict_titres(v_mode, v_debut);
  raise exception 'la preuve doit finir par la levée du verdict';
end $tpc3$;
