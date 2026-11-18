-- Preuve de la migration 5 du chantier « espace contact » : les données sensibles (20261118_contact_5_donnees_sensibles, décision de Timy
-- du 18/11). Jouée sur une base où l'état de la production d'avant contact est rejoué (outils/base_locale : reconstruire.sh, puis
-- rejouer_suite.sh --production) ; les migrations 1, 1b, 2, 3, _demo, 4 et 5 injectées dans l'ordre, puis leurs retours (5, 4, _demo, 3,
-- 2, 1b, 1).
--   structure    prérequis de l'état de départ, personnages, chaque migration et chaque retour injectés se jouent sans erreur ; la garde
--                de la migration 5 refuse tant qu'une absence porte le motif « sante » (rien n'est changé).
--   motifs       (1) la contrainte absences_annoncees_motif porte transport, demarche, famille, personnel, autre ; prevenir_absence refuse
--                « sante » (et tout code inconnu) avec la nouvelle phrase, accepte « personnel », que l'équipe lit ; « sante » écrit
--                directement est refusé par la contrainte.
--   lien         (2) _contact_srv_lien, pour une absence (lien « Voir la demande » et lien « Justificatif reçu ») : ni motif, ni mot, ni
--                texte, ni messages ; les jours, le moment, l'état, l'auteur et l'action restent ; le geste du lien marche toujours. Une
--                demande d'un autre type garde son texte et ses messages (ruling R-5Ca).
--   effacement   (3) étape 1 de l'effacement d'un stagiaire : le motif de ses absences est mis à nul avec le mot ; la ligne reste (jours,
--                moment, justificatif).
--   retour       migration 5 rejouée : refusée ; retour 5 refusé tant qu'une absence porte « personnel », et refusé si le retour 4 est
--                passé avant lui ; après le retour 5, contrainte, md5(pg_get_functiondef) des trois fonctions et empreinte égaux à ceux
--                d'avant la 5 ; les retours défont tout (5, 4, _demo, 3, 2, 1b, 1).
-- L'horloge : après la migration 2, _contact_maintenant() lit le réglage preuve.maintenant (C-21). Jours d'essai : mercredi 18 et jeudi 19
-- novembre 2026. Les motifs des absences d'essai sont valables avant comme après la migration 5 (transport, famille), sauf « personnel »,
-- posé seulement là où la 5 est jugée.
-- Modes : dans la contre-épreuve (1 à 4 et _demo injectées, la 5 non), chaque groupe de la migration 5 se joue et doit être ROUGE ; en ligne,
-- un groupe dont la migration n'est pas appliquée est sauté (ligne d'information).
-- GABARIT, à ne pas jouer tel quel : outils/assembler_repetition_roles.mjs y colle les aides communes (roles-aides.sql, titres-aides.sql,
-- contact-aides.sql), le libellé du mode, la requête d'empreinte, puis les migrations et leurs retours :
--   node outils/assembler_repetition_roles.mjs contact-5 <sortie.sql>                 migrations injectées : VERT attendu
--   node outils/assembler_repetition_roles.mjs contact-5-contre-epreuve <sortie.sql>  la 5 et son retour neutralisés : ROUGE attendu
--                                                                                      sur les seuls contrôles de la migration 5
--   node outils/assembler_repetition_roles.mjs contact-5-en-ligne <sortie.sql>        rien d'injecté, après application réelle
-- À jouer sur la base locale : PGCLIENTENCODING=UTF8 psql -h 127.0.0.1 -p <port> -U postgres -d postgres -X -q -f <sortie.sql>
-- Le bloc do finit TOUJOURS par une levée (verdict) : migrations, personnages et lignes d'essai sont annulés, rien ne reste. Mode en ligne
-- sur une base qui sert : le bloc remplace _contact_maintenant le temps de la transaction (annulée).

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
returns text language plpgsql as $cd5_em$
begin
  return (select email from pg_temp.perso where nom = p_qui);
end $cd5_em$;

-- Les fiches des personnages, par nom (pg_temp.cles) : fiche avec compte (compte_email), ou la fiche sans compte sec_n. Posée après la
-- migration 1 ; un personnage sans fiche n'y figure pas.
create or replace function pg_temp.poser_cles()
returns void language plpgsql as $cd5_pc$
begin
  drop table if exists pg_temp.cles;
  create temp table cles (cle text primary key, fiche_id bigint not null);
  begin
    execute $cd5_q$insert into pg_temp.cles (cle, fiche_id)
      select p.nom, c.id from pg_temp.perso p join public.contacts c on c.compte_email = lower(p.email)
      union all
      select p.nom, p.info::bigint from pg_temp.perso p where p.nom = 'sec_n'$cd5_q$;
  exception when others then
    null; -- migration 1 absente : la table reste vide, les contrôles qui s'en servent sont rouges
  end;
end $cd5_pc$;

-- La fiche d'un personnage (texte), ou « null ».
create or replace function pg_temp.fiche(p_cle text)
returns text language plpgsql as $cd5_fi$
begin
  return coalesce((select fiche_id::text from pg_temp.cles where cle = p_cle), 'null');
end $cd5_fi$;

-- La fiche stagiaire d'un personnage (texte), ou « null » : celle de son profil, sinon celle de pg_temp.perso.info.
create or replace function pg_temp.stag(p_qui text)
returns text language plpgsql as $cd5_st$
begin
  return coalesce((select up.stagiaire_id::text from public.user_profiles up where up.email = pg_temp.email_de(p_qui)),
                  (select info from pg_temp.perso where nom = p_qui and role = 'stagiaire' and info ~ '^[0-9]+$'), 'null');
end $cd5_st$;

-- L'identifiant rendu par un appel réussi (« OK 12 » : 12), sinon « null ».
create or replace function pg_temp.id_rendu(p_appel text)
returns text language sql as $cd5_ir$
  select case when p_appel ~ '^OK [0-9]+$' then substr(p_appel, 4) else 'null' end;
$cd5_ir$;

-- L'horloge de la preuve (heure de Paris).
create or replace function pg_temp.horloge(p_quand text)
returns void language sql as $cd5_ho$
  select set_config('preuve.maintenant', p_quand || ' Europe/Paris', true);
$cd5_ho$;

-- Prévenir d'une absence le matin du jour p_du, par un personnage (en-tête de la promo 1) : « OK <id> » ou « ERREUR <état> <message> ».
create or replace function pg_temp.prevenir(p_qui text, p_du text, p_motif text, p_mot text, p_choisis text)
returns text language sql as $cd5_pv$
  select pg_temp.appeler(p_qui, '1', format('select public.prevenir_absence(%L::date, null, ''matin'', null, null, %L, %L, ''{}''::text[], %s)::text',
    p_du, p_motif, p_mot, coalesce(p_choisis, 'null')));
$cd5_pv$;

-- Un appel en service_role (la fonction serveur) : la valeur jsonb rendue, ou {"erreur": "<état> <message>"}. Rend la main au propriétaire.
create or replace function pg_temp.srv(p_sql text)
returns jsonb language plpgsql as $cd5_sv$
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
end $cd5_sv$;

-- Les clés de l'objet « demande » rendu par un lien, triées et jointes par des virgules.
create or replace function pg_temp.cles_demande(r jsonb)
returns text language sql as $cd5_cd$
  select coalesce((select string_agg(k, ',' order by k) from jsonb_object_keys(case when jsonb_typeof(r -> 'demande') = 'object' then r -> 'demande'
                                                                                  else '{}'::jsonb end) k), 'aucune : ' || left(r::text, 120));
$cd5_cd$;

-- La contrainte des motifs (pg_get_constraintdef), ou « absente ».
create or replace function pg_temp.contrainte_motif()
returns text language sql as $cd5_ct$
  select coalesce(pg_temp.calcul($cd5_q$select pg_get_constraintdef(c.oid) from pg_constraint c
      where c.conrelid = to_regclass('public.absences_annoncees') and c.conname = 'absences_annoncees_motif'$cd5_q$), 'absente');
$cd5_ct$;

-- md5(pg_get_functiondef) des trois fonctions que la migration 5 redéfinit : « signature=md5;... ».
create or replace function pg_temp.md5_trois()
returns text language sql as $cd5_m5$
  select coalesce(string_agg(p.oid::regprocedure::text || '=' || md5(pg_get_functiondef(p.oid)), ';' order by p.oid::regprocedure::text), 'aucune')
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('prevenir_absence', '_contact_srv_lien', '_contact_effacer_stagiaire');
$cd5_m5$;

-- Un texte (migration, retour) joué puis TOUJOURS annulé : « refusée <état> <message> », ou « acceptée (annulée) ».
create or replace function pg_temp.essayer_et_annuler(p_sql text)
returns text language plpgsql as $cd5_en$
begin
  begin
    execute p_sql;
    raise exception using errcode = 'P0001', message = 'CD5_ACCEPTEE';
  exception when others then
    if sqlerrm = 'CD5_ACCEPTEE' then
      return 'acceptée (annulée)';
    end if;
    return 'refusée ' || sqlstate || ' ' || left(sqlerrm, 200);
  end;
end $cd5_en$;

-- Les personnages de cette preuve, posés après la migration 4 : stag_a et stag_e (promo 1, avec compte : stag_e sera effacé) ; aucune
-- règle dans le centre de la promo 1 (mode choix : le stagiaire choisit dir_n). Si une pose échoue, une ligne d'information le dit.
create or replace function pg_temp.poser_donnees()
returns void language plpgsql as $cd5_po$
declare
  r record;
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_s integer;
  v_email text;
begin
  for r in select * from (values (70, 'stag_a'), (71, 'stag_e')) x(ordre, nom) loop
    v_email := 'preuve18.' || replace(r.nom, '_', '.') || '@exemple.invalid';
    insert into public.stagiaires (prenom, nom, ordre, promo_id) values ('Preuve18 ' || r.nom, 'PREUVE', 990, 1) returning id into v_s;
    insert into pg_temp.perso (ordre, nom, email, role, info) values (r.ordre, r.nom, v_email, 'stagiaire', v_s::text);
    insert into public.user_profiles (email, role, is_admin, stagiaire_id) values (v_email, 'stagiaire', false, v_s);
  end loop;
  delete from public.contact_regles where lieu_id = v_l1;
exception when others then
  perform pg_temp.informer('personnages des données sensibles', 'pose impossible : ' || sqlstate || ' ' || left(sqlerrm, 160));
end $cd5_po$;

-- Groupe motifs (1). Mercredi 18 novembre, 18 h : stag_a prévient pour le jeudi 19 matin, dir_n choisi.
create or replace function pg_temp.groupe_motifs()
returns void language plpgsql as $cd5_gm$
declare
  v_choix text := format('array[%s]::bigint[]', pg_temp.fiche('dir_n'));
  v_id text;
begin
  perform pg_temp.horloge('2026-11-18 18:00');
  perform pg_temp.attendre('motifs', 'la contrainte absences_annoncees_motif : transport, demarche, famille, personnel, autre (dans cet ordre), sans sante',
    pg_temp.contrainte_motif(),
    'CHECK ((motif = ANY (ARRAY[''transport''::text, ''demarche''::text, ''famille''::text, ''personnel''::text, ''autre''::text])))');
  perform pg_temp.attendre('motifs', 'prevenir_absence : « sante » et un code inconnu refusés, avec la nouvelle phrase',
    pg_temp.prevenir('stag_a', '2026-11-19', 'sante', null, v_choix) || ' / ' || pg_temp.prevenir('stag_a', '2026-11-19', 'maladie', null, v_choix),
    'ERREUR P0001 contact: Choisis un motif : transport, démarche, famille, raison personnelle ou autre. / '
      || 'ERREUR P0001 contact: Choisis un motif : transport, démarche, famille, raison personnelle ou autre.');
  v_id := pg_temp.id_rendu(pg_temp.prevenir('stag_a', '2026-11-19', 'personnel', null, v_choix));
  perform pg_temp.attendre('motifs', 'prevenir_absence : « personnel » accepté, gardé tel quel ; dir_n (destinataire) le lit dans demande_detail',
    pg_temp.calcul(format('select coalesce((select motif from public.absences_annoncees where demande_id = %s), ''aucune absence'')', v_id)) || ' / '
      || pg_temp.appeler('dir_n', '1', format($cd5_q$select public.demande_detail(%s) -> 'absence' ->> 'motif'$cd5_q$, v_id)),
    'personnel / OK personnel');
  perform pg_temp.attendre('motifs', '« sante » écrit directement (propriétaire) dans une absence : refusé par la contrainte',
    pg_temp.essai(format($cd5_q$update public.absences_annoncees set motif = 'sante' where demande_id = %s$cd5_q$, v_id)),
    'ERREUR 23514');
  perform pg_temp.essai('delete from public.demandes where auteur_stagiaire_id = ' || pg_temp.stag('stag_a'));
end $cd5_gm$;

-- Groupe lien (2). Mercredi 18 novembre, 18 h. Une absence de stag_a (famille, un mot) choisie pour dir_n, qui y répond ; une demande
-- « autre » de stag_a à dir_n (sujet, texte), à laquelle dir_n répond aussi. Jetons de la fiche de dir_n posés en propriétaire (comme
-- _contact_srv_jetons, sans envoi) : « voir » et « justificatif » pour l'absence, « voir » pour l'autre demande. La fonction serveur les
-- juge en service_role.
create or replace function pg_temp.groupe_lien()
returns void language plpgsql as $cd5_gl$
declare
  f_dir text := pg_temp.fiche('dir_n');
  v_choix text := format('array[%s]::bigint[]', pg_temp.fiche('dir_n'));
  v_abs text;
  v_autre text;
  r jsonb;
  h_voir constant text := repeat('c1', 32);
  h_justif constant text := repeat('c2', 32);
  h_autre constant text := repeat('c3', 32);
  c_jeton constant text := $cd5_q$insert into public.contact_jetons (hash, demande_id, fiche_id, action, expire_le)
      values (decode(%L, 'hex'), %s, %s, %L, public._contact_maintenant() + interval '14 days')$cd5_q$;
begin
  perform pg_temp.horloge('2026-11-18 18:00');
  v_abs := pg_temp.id_rendu(pg_temp.prevenir('stag_a', '2026-11-19', 'famille', 'Preuve18 mot du lien', v_choix));
  perform pg_temp.appeler('dir_n', '1', format('select (public.repondre_demande(%s, %L) is not null)::text', v_abs, 'Preuve18 réponse à l''absence'));
  v_autre := pg_temp.id_rendu(pg_temp.appeler('stag_a', '1', format('select public.ecrire_a(%s, %L, %L, %L)::text', f_dir, 'autre', 'Preuve18 sujet', 'Preuve18 texte autre')));
  perform pg_temp.appeler('dir_n', '1', format('select (public.repondre_demande(%s, %L) is not null)::text', v_autre, 'Preuve18 réponse autre'));
  perform pg_temp.verifier('lien', 'mise en place : l''absence et la demande « autre » existent, chacune avec un message de dir_n',
    pg_temp.calcul(format('select count(*)::text from public.demande_messages where demande_id in (%s, %s)', v_abs, v_autre)) = '2',
    concat_ws(' ', v_abs, v_autre));
  perform pg_temp.essai(format(c_jeton, h_voir, v_abs, f_dir, 'voir'));
  perform pg_temp.essai(format(c_jeton, h_justif, v_abs, f_dir, 'justificatif'));
  perform pg_temp.essai(format(c_jeton, h_autre, v_autre, f_dir, 'voir'));
  r := pg_temp.srv(format('select public._contact_srv_lien(%L)', h_voir));
  perform pg_temp.attendre('lien', 'absence, lien « Voir la demande » : l''objet demande n''a ni motif, ni mot, ni texte, ni messages',
    pg_temp.cles_demande(r), 'auteur_nom,cree_le,etat,id,jours,moment,sujet,type');
  perform pg_temp.attendre('lien', 'absence, lien « Voir la demande » : ce qui reste (type, état, jours, moment, action) ; le mot, le motif et la réponse n''apparaissent nulle part dans la réponse',
    concat_ws('|', r -> 'demande' ->> 'type', r -> 'demande' ->> 'etat', r -> 'demande' -> 'jours', r -> 'demande' -> 'moment' ->> 'quand',
      r -> 'demande' -> 'moment' ->> 'du', r ->> 'action',
      (r::text like '%famille%' or r::text like '%Preuve18 mot du lien%' or r::text like '%Preuve18 réponse à l%')::text),
    'absence|envoyee|[{"demi": "matin", "jour": "2026-11-19"}]|matin|2026-11-19|voir|false');
  r := pg_temp.srv(format('select public._contact_srv_lien(%L)', h_justif));
  perform pg_temp.attendre('lien', 'absence, lien « Justificatif reçu » : mêmes clés (ni motif, ni mot, ni texte, ni messages), action justificatif, pas encore fait',
    pg_temp.cles_demande(r) || ' / ' || concat_ws('|', r ->> 'action', r ->> 'deja',
      (r::text like '%famille%' or r::text like '%Preuve18 mot du lien%' or r::text like '%Preuve18 réponse à l%')::text),
    'auteur_nom,cree_le,etat,id,jours,moment,sujet,type / justificatif|false|false');
  perform pg_temp.attendre('lien', 'le geste du lien marche toujours : _contact_srv_agir (justificatif) fait, justificatif reçu',
    pg_temp.srv(format('select public._contact_srv_agir(%L)', h_justif))::text || ' / '
      || pg_temp.calcul(format('select coalesce(justificatif, ''-'') from public.absences_annoncees where demande_id = %s', v_abs)),
    '{"fait": true} / recu');
  r := pg_temp.srv(format('select public._contact_srv_lien(%L)', h_autre));
  perform pg_temp.attendre('lien', 'une demande « autre » (ruling R-5Ca) : le lien garde son texte et ses messages, comme avant la migration 5',
    pg_temp.cles_demande(r) || ' / ' || concat_ws('|', r -> 'demande' ->> 'texte', jsonb_array_length(r -> 'demande' -> 'messages'),
      r -> 'demande' -> 'messages' -> 0 ->> 'texte'),
    'auteur_nom,cree_le,etat,id,jours,messages,moment,mot,motif,sujet,texte,type / Preuve18 texte autre|1|Preuve18 réponse autre');
  perform pg_temp.essai('delete from public.demandes where auteur_stagiaire_id = ' || pg_temp.stag('stag_a'));
end $cd5_gl$;

-- Groupe effacement (3). Mercredi 18 novembre, 18 h : une absence de stag_e (transport, un mot), justificatif à remettre (dir_n) ; puis
-- l'étape 1 de l'effacement (_effacer_etape1, celle de la fin de formation + 12 mois et de l'effacement sur demande).
create or replace function pg_temp.groupe_effacement()
returns void language plpgsql as $cd5_ge$
declare
  s_e text := pg_temp.stag('stag_e');
  v_id text;
  v text;
  c_ligne constant text := $cd5_q$select concat_ws('|', a.du, a.quand, coalesce(a.motif, '-'), coalesce(a.justificatif, '-'), coalesce(d.texte, '-'))
      from public.absences_annoncees a join public.demandes d on d.id = a.demande_id where a.demande_id = %s$cd5_q$;
begin
  perform pg_temp.horloge('2026-11-18 18:00');
  v_id := pg_temp.id_rendu(pg_temp.prevenir('stag_e', '2026-11-19', 'transport', 'Preuve18 mot à effacer', format('array[%s]::bigint[]', pg_temp.fiche('dir_n'))));
  perform pg_temp.attendre('effacement', 'témoin : l''absence de stag_e porte son motif, son mot et un justificatif à remettre',
    pg_temp.appeler('dir_n', '1', format('select public.regler_justificatif(%s, %L)::text', v_id, 'a_remettre')) || ' / ' || pg_temp.calcul(format(c_ligne, v_id)),
    'OK / 2026-11-19|matin|transport|a_remettre|Preuve18 mot à effacer');
  v := pg_temp.calcul(format('select (public._effacer_etape1(%s) is not null)::text', s_e));
  perform pg_temp.attendre('effacement', 'étape 1 de l''effacement de stag_e : le motif part avec le mot ; la ligne reste (jour, moment, justificatif)',
    v || ' / ' || pg_temp.calcul(format(c_ligne, v_id)), 'true / 2026-11-19|matin|-|a_remettre|-');
  perform pg_temp.attendre('effacement', 'la fiche n''est pas encore rendue anonyme (l''étape 2 viendra plus tard) : le motif est parti dès l''étape 1',
    pg_temp.calcul(format('select concat_ws(''|'', (efface_le is not null)::text, (anonymise_le is not null)::text) from public.stagiaires where id = %s', s_e)),
    'true|false');
end $cd5_ge$;

-- Un groupe se joue-t-il dans ce mode ? Contre-épreuve : toujours (il doit être rouge). En ligne : seulement si p_condition (la
-- migration qui le fonde est appliquée), sinon une ligne d'information. Migrations injectées : toujours.
create or replace function pg_temp.groupe_a_jouer(p_groupe text, p_mode text, p_condition boolean, p_raison text)
returns boolean language plpgsql as $cd5_gj$
begin
  if p_mode like 'contact-5-en-ligne%' and not coalesce(p_condition, false) then
    perform pg_temp.informer('groupe ' || p_groupe, 'sauté : ' || p_raison || ' (mode en ligne)');
    return false;
  end if;
  return true;
end $cd5_gj$;

do $tpc5$
declare
  v_mode constant text :=
-- @@MODE@@
  ;
  v_debut constant timestamptz := clock_timestamp();
  v_en_ligne boolean;
  v_m5 text;
  v_r5 text;
  v_r4 text;
  v_etat1 text; v_etat1b text; v_etat2 text; v_etat3 text; v_etat_demo text; v_etat4 text; v_etat5 text;
  v_retour5 text; v_retour4 text; v_retour_demo text; v_retour3 text; v_retour2 text; v_retour1b text; v_retour1 text;
  v_av_regles text; v_av_fonctions text; v_av_droits text;
  v_ap_regles text; v_ap_fonctions text; v_ap_droits text;
  v_a5_regles text; v_a5_fonctions text; v_a5_droits text;
  v_r5_regles text; v_r5_fonctions text; v_r5_droits text;
  v_md5_avant5 text; v_md5_apres5 text; v_md5_retour5 text;
  v_contrainte_avant5 text;
  v_jouees integer;
  v_partie5 boolean;
  v_refus text;
  v_id text;
begin
  perform set_config('lock_timeout', '3s', true);
  v_en_ligne := v_mode like 'contact-5-en-ligne%';

  -- 1. Avant les migrations : l'empreinte de la base, puis les prérequis de l'état de départ (la production du 16/11).
  select e.regles, e.fonctions, e.droits into v_av_regles, v_av_fonctions, v_av_droits from pg_temp.empreinte() e;
  perform pg_temp.verifier('structure', 'prérequis : geste_promo(integer, text) existe (titres, migration 2)',
    to_regprocedure('public.geste_promo(integer, text)') is not null);
  perform pg_temp.verifier('structure', 'prérequis : _effacer_etape1(integer) existe (conservation)',
    to_regprocedure('public._effacer_etape1(integer)') is not null);
  perform pg_temp.verifier('structure', 'prérequis : un seul lieu de démonstration (la migration _demo le demande)',
    (select count(*) from public.lieux where demonstration) = 1);

  -- 2. Les personnages du chantier, posés AVANT les migrations (comme les comptes de la production) : lot 4, titres, la fiche sec_n.
  perform pg_temp.poser_contact();
  perform pg_temp.attendre('structure', 'les personnages sont posés (16 du lot 4, 5 des titres, la fiche sans compte sec_n)',
    pg_temp.calcul($cd5_q$select concat_ws('/', (select count(*) from perso where ordre between 1 and 16)::text,
      (select count(*) from perso where ordre between 20 and 24)::text, (select count(*) from perso where nom = 'sec_n')::text)$cd5_q$),
    '16/5/1');

  -- 3. Les migrations, dans l'ordre d'application en production (1b en plus, comme les autres preuves du chantier ; neutralisées dans les
  --    modes sans elles).
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
  v_etat3 := pg_temp.jouer('migration 3',
-- @@INJECTER supabase/migrations/20261115_contact_3_absences.sql@@
  );
  perform pg_temp.etape('migration 3', v_etat3, v_mode);
  v_etat_demo := pg_temp.jouer('migration _demo',
-- @@INJECTER supabase/migrations/20261115_contact_demo.sql@@
  );
  perform pg_temp.etape('migration _demo', v_etat_demo, v_mode);
  v_etat4 := pg_temp.jouer('migration 4',
-- @@INJECTER supabase/migrations/20261116_contact_4_correctifs.sql@@
  );
  perform pg_temp.etape('migration 4', v_etat4, v_mode);
  -- L'horloge de la preuve (C-21) : _contact_maintenant() lit preuve.maintenant (annulé avec le reste). Posée avant le relevé « avant 5 ».
  if to_regprocedure('public._contact_maintenant()') is not null then
    execute $cd5_q$create or replace function public._contact_maintenant() returns timestamptz language sql stable security definer
      set search_path = public, pg_temp as 'select coalesce(nullif(current_setting(''preuve.maintenant'', true), '''')::timestamptz, now())'$cd5_q$;
  end if;
  perform pg_temp.poser_cles();
  perform pg_temp.poser_donnees();
  select e.regles, e.fonctions, e.droits into v_a5_regles, v_a5_fonctions, v_a5_droits from pg_temp.empreinte() e;
  v_md5_avant5 := pg_temp.md5_trois();
  v_contrainte_avant5 := pg_temp.contrainte_motif();
  v_m5 :=
-- @@INJECTER supabase/migrations/20261118_contact_5_donnees_sensibles.sql@@
  ;
  -- La garde de la migration 5 : une absence « sante » (encore acceptée avant elle) l'arrête sans rien changer.
  if v_m5 <> 'select 1' and not v_en_ligne then
    perform pg_temp.horloge('2026-11-18 18:00');
    v_id := pg_temp.id_rendu(pg_temp.prevenir('stag_a', '2026-11-19', 'sante', null, format('array[%s]::bigint[]', pg_temp.fiche('dir_n'))));
    v_refus := pg_temp.essayer_et_annuler(v_m5);
    perform pg_temp.verifier('structure', 'migration 5 tant qu''une absence porte « sante » : refusée par sa garde, qui dit quoi faire ; rien n''est changé',
      v_id <> 'null' and v_refus like 'refusée P0001 contact\_5 : 1 absence(s) portent encore le motif « sante » : décider avec Timy%'
        and pg_temp.contrainte_motif() = v_contrainte_avant5 and pg_temp.md5_trois() = v_md5_avant5,
      concat_ws(' / ', v_id, v_refus));
    perform pg_temp.essai('delete from public.demandes where auteur_stagiaire_id = ' || pg_temp.stag('stag_a'));
    perform set_config('preuve.maintenant', '', true);
  end if;
  v_etat5 := pg_temp.jouer('migration 5', v_m5);
  perform pg_temp.etape('migration 5', v_etat5, v_mode);
  v_md5_apres5 := pg_temp.md5_trois();

  -- 4. GROUPES de contrôles de la migration 5, chacun sauté avec une ligne d'information quand elle n'est pas encore appliquée (mode en
  --    ligne) ; dans la contre-épreuve, ils se jouent et doivent être rouges.
  v_partie5 := pg_temp.migration_5();
  if pg_temp.groupe_a_jouer('motifs', v_mode, v_partie5, 'la migration 5 n''est pas appliquée') then
    perform pg_temp.groupe_motifs();
  end if;
  if pg_temp.groupe_a_jouer('lien', v_mode, v_partie5, 'la migration 5 n''est pas appliquée') then
    perform pg_temp.groupe_lien();
  end if;
  if pg_temp.groupe_a_jouer('effacement', v_mode, v_partie5, 'la migration 5 n''est pas appliquée') then
    perform pg_temp.groupe_effacement();
  end if;
  perform set_config('preuve.maintenant', '', true);

  -- 5. Les retours, dans l'ordre inverse (5, 4, _demo, 3, 2, 1b, 1). Avant le retour 5 : la migration 5 rejouée est refusée ; le retour 5
  --    est refusé tant qu'une absence porte « personnel », et s'il passe après le retour 4 (mauvais ordre).
  v_r5 :=
-- @@INJECTER supabase/migrations/20261118_contact_5_donnees_sensibles_retour.sql@@
  ;
  v_r4 :=
-- @@INJECTER supabase/migrations/20261116_contact_4_correctifs_retour.sql@@
  ;
  if v_m5 = 'select 1' or v_en_ligne then
    perform pg_temp.informer('retour', 'migration 5 rejouée et gardes du retour 5 : non jugeables (migration 5 non injectée)');
    if not v_en_ligne then
      perform pg_temp.verifier('retour', 'la migration 5 est injectée (contre-épreuve : non)', false, v_mode);
    end if;
  else
    perform pg_temp.attendre('retour', 'migration 5 rejouée : refusée par sa garde, rien n''est changé',
      pg_temp.essayer_et_annuler(v_m5),
      'refusée P0001 contact_5 : la contrainte absences_annoncees_motif admet déjà « personnel », migration déjà appliquée ? rien n''est changé');
    perform pg_temp.horloge('2026-11-18 18:00');
    v_id := pg_temp.id_rendu(pg_temp.prevenir('stag_a', '2026-11-19', 'personnel', null, format('array[%s]::bigint[]', pg_temp.fiche('dir_n'))));
    v_refus := pg_temp.essayer_et_annuler(v_r5);
    perform pg_temp.verifier('retour', 'retour 5 tant qu''une absence porte « personnel » : refusé par sa garde, qui dit quoi faire',
      v_id <> 'null' and v_refus like 'refusée P0001 contact\_5\_retour : 1 absence(s) portent le motif « personnel », que la contrainte d''origine refuse%',
      concat_ws(' / ', v_id, v_refus));
    perform pg_temp.essai('delete from public.demandes where auteur_stagiaire_id = ' || pg_temp.stag('stag_a'));
    perform set_config('preuve.maintenant', '', true);
    v_refus := pg_temp.essayer_et_annuler(v_r4 || E'\n' || v_r5);
    perform pg_temp.verifier('retour', 'retour 5 joué après le retour 4 (mauvais ordre) : refusé par sa garde, qui dit quoi faire',
      v_refus like 'refusée P0001 contact\_5\_retour : la migration 4 n''est plus là (retour 4 joué avant celui-ci ?) : rejouer la migration 4, puis ce retour, puis le retour 4%', v_refus);
  end if;
  v_retour5 := pg_temp.jouer('retour 5', v_r5);
  perform pg_temp.etape('retour 5', v_retour5, v_mode);
  select e.regles, e.fonctions, e.droits into v_r5_regles, v_r5_fonctions, v_r5_droits from pg_temp.empreinte() e;
  v_md5_retour5 := pg_temp.md5_trois();
  if v_en_ligne then
    perform pg_temp.informer('retour 5', format('non jugeable (migrations déjà appliquées) ; md5 des trois fonctions : %s', v_md5_apres5));
  else
    perform pg_temp.verifier('retour', 'la migration 5 redéfinit les trois fonctions (md5 de pg_get_functiondef changé pour chacune)',
      v_md5_apres5 <> v_md5_avant5
        and (select bool_and(a.v <> b.v) from unnest(string_to_array(v_md5_avant5, ';')) with ordinality a(v, n)
               join unnest(string_to_array(v_md5_apres5, ';')) with ordinality b(v, n) on a.n = b.n)
        and array_length(string_to_array(v_md5_avant5, ';'), 1) = 3,
      'avant ' || v_md5_avant5 || ' ; après ' || v_md5_apres5);
    perform pg_temp.attendre('retour', 'après le retour 5 : md5(pg_get_functiondef) des trois fonctions égal à celui d''avant la migration 5', v_md5_retour5, v_md5_avant5);
    perform pg_temp.attendre('retour', 'après le retour 5 : la contrainte des motifs a son texte d''avant la migration 5 (avec sante)', pg_temp.contrainte_motif(), v_contrainte_avant5);
    perform pg_temp.attendre('retour', 'après le retour 5 : empreinte regles égale à celle d''avant la migration 5', v_r5_regles, v_a5_regles);
    perform pg_temp.attendre('retour', 'après le retour 5 : empreinte fonctions égale à celle d''avant la migration 5', v_r5_fonctions, v_a5_fonctions);
    perform pg_temp.attendre('retour', 'après le retour 5 : empreinte droits égale à celle d''avant la migration 5', v_r5_droits, v_a5_droits);
  end if;
  v_retour4 := pg_temp.jouer('retour 4', v_r4);
  perform pg_temp.etape('retour 4', v_retour4, v_mode);
  v_retour_demo := pg_temp.jouer('retour _demo',
-- @@INJECTER supabase/migrations/20261115_contact_demo_retour.sql@@
  );
  perform pg_temp.etape('retour _demo', v_retour_demo, v_mode);
  v_retour3 := pg_temp.jouer('retour 3',
-- @@INJECTER supabase/migrations/20261115_contact_3_absences_retour.sql@@
  );
  perform pg_temp.etape('retour 3', v_retour3, v_mode);
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
  v_jouees := (v_etat1 = 'jouée')::integer + (v_etat2 = 'jouée')::integer + (v_etat3 = 'jouée')::integer + (v_etat4 = 'jouée')::integer
    + (v_etat5 = 'jouée')::integer;
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
end $tpc5$;
