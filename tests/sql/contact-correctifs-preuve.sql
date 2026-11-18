-- Preuve de la migration 4 du chantier « espace contact » : les correctifs relevés en relecture (20261116_contact_4_correctifs). Jouée sur
-- une base où l'état de la production d'avant contact est rejoué (outils/base_locale : reconstruire.sh, puis rejouer_suite.sh
-- --production) ; les migrations 1, 1b, 2, 3 et 4 injectées dans l'ordre, puis leurs retours (4, 3, 2, 1b, 1).
--   structure       prérequis de l'état de départ, personnages, chaque migration et chaque retour injectés se jouent sans erreur.
--   envois          (1) _contact_srv_resultat, issue « limite » : l'envoi repasse « à retenter » dans 5 minutes, sa tentative rendue,
--                   ses jetons retirés ; un envoi qui n'est plus « en cours » n'est pas touché ; « echec » inchangé ; un envoi créé
--                   depuis plus de 24 heures passe en échec (« Resend 429 durable »), un envoi de 23 heures reste à retenter.
--   reglages        (2) reglages_contact() rend peut_modifier : vrai pour qui modifie les réglages du centre, faux en lecture seule.
--   indisponibles   (3) une fiche en congé ou partie n'est ni proposée ni pré-cochée (mode choix) ni prévenue en annexe d'une absence :
--                   son nom y figure en « non prévenu ».
--   quota           (4) 30 nouvelles conversations par jour pour une fiche de l'équipe (ecrire_a, ecrire_au_stagiaire) ; la 31e est
--                   refusée ; une réponse dans une conversation existante passe ; un autre membre garde son quota ; l'index du quota.
--   absences        (5) prevenir_absence borne le début à 120 jours ; regler_justificatif juge le droit avant le type ; le pré-marquage
--                   cède à une signature écrite au même instant (on conflict) ; le chemin du justificatif verrouille la feuille.
--   annuaire        (6) coordonnees_promo ignore une fiche effacée ; l'effacement vide la marque de délégué, et le rattrapage de la
--                   migration celle d'un stagiaire effacé avant elle ; ordonner_fiches accepte la liste entière de l'annuaire et ignore
--                   une fiche sans compte d'un autre centre partagée (elle garde son ordre) ; regler_financements verrouille avant de
--                   contrôler.
--   liens           (8) _contact_srv_jeton : le lien d'une fiche sans compte partie (départ passé) est invalide, en lecture comme pour
--                   le geste ; le jour du départ, il vaut encore.
--   demandes        (7) ecrire_au_stagiaire tutoie un stagiaire ; l'effacement d'un stagiaire qui n'est qu'en annexe d'une demande
--                   d'un autre la laisse en place ; _contact_jours refuse proprement une entrée illisible (déjà vrai depuis la 2).
--   retour          migration 4 rejouée : refusée ; retour 4 refusé si le retour 3 est passé avant lui ; après le retour 4, empreinte et
--                   md5(pg_get_functiondef) des seize fonctions égaux à ceux d'avant la 4, index retiré ; les retours défont tout (4, 3,
--                   2, 1b, 1).
-- Deux verrous (5 et 6) ne se prouvent pas dans une seule session : leur contrôle lit le texte de la fonction (pg_get_functiondef).
-- L'horloge : après la migration 2, _contact_maintenant() lit le réglage preuve.maintenant (C-21) ; le jour de l'émargement aussi, le temps
-- du groupe absences. Jours d'essai : mercredi 18 et jeudi 19 novembre 2026.
-- Modes : dans la contre-épreuve, chaque groupe de la migration 4 se joue et doit être ROUGE ; en ligne, un groupe dont la migration n'est
-- pas appliquée est sauté (ligne d'information).
-- GABARIT, à ne pas jouer tel quel : outils/assembler_repetition_roles.mjs y colle les aides communes (roles-aides.sql, titres-aides.sql,
-- contact-aides.sql), le libellé du mode, la requête d'empreinte, puis les migrations 1 à 4 et leurs retours :
--   node outils/assembler_repetition_roles.mjs contact-4 <sortie.sql>                 migrations injectées : VERT attendu
--   node outils/assembler_repetition_roles.mjs contact-4-contre-epreuve <sortie.sql>  la 4 et son retour neutralisés : ROUGE attendu
--                                                                                      sur les seuls contrôles de la migration 4
--   node outils/assembler_repetition_roles.mjs contact-4-en-ligne <sortie.sql>        rien d'injecté, après application réelle
-- À jouer sur la base locale : PGCLIENTENCODING=UTF8 psql -h 127.0.0.1 -p <port> -U postgres -d postgres -X -q -f <sortie.sql>
-- Le bloc do finit TOUJOURS par une levée (verdict) : migrations, personnages et lignes d'essai sont annulés, rien ne reste.
-- Mode en ligne sur une base qui sert : le bloc remplace _cases_valides et emargement_jour_paris et pose un déclencheur sur
-- emargement_lignes (verrou gardé jusqu'à l'annulation : une signature attend la fin du bloc) ; le jouer hors des heures de feuille.

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
returns text language plpgsql as $cc_em$
begin
  return (select email from pg_temp.perso where nom = p_qui);
end $cc_em$;

-- Les fiches des personnages, par nom (pg_temp.cles) : fiche avec compte (compte_email), ou la fiche sans compte sec_n. Posée après la
-- migration 1 ; un personnage sans fiche n'y figure pas.
create or replace function pg_temp.poser_cles()
returns void language plpgsql as $cc_pc$
begin
  drop table if exists pg_temp.cles;
  create temp table cles (cle text primary key, fiche_id bigint not null);
  begin
    execute $cc_q$insert into pg_temp.cles (cle, fiche_id)
      select p.nom, c.id from pg_temp.perso p join public.contacts c on c.compte_email = lower(p.email)
      union all
      select p.nom, p.info::bigint from pg_temp.perso p where p.nom = 'sec_n'$cc_q$;
  exception when others then
    null; -- migration 1 absente : la table reste vide, les contrôles qui s'en servent sont rouges
  end;
end $cc_pc$;

-- La fiche d'un personnage (texte), ou « null ».
create or replace function pg_temp.fiche(p_cle text)
returns text language plpgsql as $cc_fi$
begin
  return coalesce((select fiche_id::text from pg_temp.cles where cle = p_cle), 'null');
end $cc_fi$;

-- La fiche stagiaire d'un personnage (texte), ou « null » : celle de son profil, sinon (sans compte) celle de pg_temp.perso.info.
create or replace function pg_temp.stag(p_qui text)
returns text language plpgsql as $cc_st$
begin
  return coalesce((select up.stagiaire_id::text from public.user_profiles up where up.email = pg_temp.email_de(p_qui)),
                  (select info from pg_temp.perso where nom = p_qui and role = 'stagiaire' and info ~ '^[0-9]+$'), 'null');
end $cc_st$;

-- L'identifiant rendu par un appel réussi (« OK 12 » : 12), sinon « null ».
create or replace function pg_temp.id_rendu(p_appel text)
returns text language sql as $cc_ir$
  select case when p_appel ~ '^OK [0-9]+$' then substr(p_appel, 4) else 'null' end;
$cc_ir$;

-- L'horloge de la preuve (heure de Paris).
create or replace function pg_temp.horloge(p_quand text)
returns void language sql as $cc_ho$
  select set_config('preuve.maintenant', p_quand || ' Europe/Paris', true);
$cc_ho$;

-- Prévenir d'une absence, par un personnage (en-tête de la promo 1) : « OK <id> » ou « ERREUR <état> <message> ».
create or replace function pg_temp.prevenir(p_qui text, p_du text, p_quand text, p_motif text, p_choisis text)
returns text language sql as $cc_pv$
  select pg_temp.appeler(p_qui, '1', format('select public.prevenir_absence(%L::date, null, %L, null, null, %L, null, ''{}''::text[], %s)::text',
    p_du, p_quand, p_motif, coalesce(p_choisis, 'null')));
$cc_pv$;

-- Un appel en service_role (la fonction serveur) : la valeur jsonb rendue, ou {"erreur": "<état> <message>"}. Rend la main au propriétaire.
create or replace function pg_temp.srv(p_sql text)
returns jsonb language plpgsql as $cc_sv$
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
end $cc_sv$;

-- Un geste de la fonction serveur (service_role) qui ne rend rien : « fait », ou « ERREUR <état> <message> ».
create or replace function pg_temp.srv_geste(p_sql text)
returns text language sql as $cc_sg$
  select coalesce(v ->> 'erreur', 'fait')
    from (select pg_temp.srv(format('select ''{}''::jsonb from (%s) x', p_sql)) v) s;
$cc_sg$;

-- Les destinataires d'une demande, dans l'ordre : « fiche:P » (principal), « fiche:annexe », « s<stagiaire>:annexe », « n:annexe:nom ».
create or replace function pg_temp.dest_de(p_id text)
returns text language sql as $cc_dd$
  select pg_temp.calcul(format($cc_q$select coalesce(string_agg(coalesce(x.fiche_id::text, 's' || x.stagiaire_id, 'n') || ':'
      || case when x.principal then 'P' else x.annexe end || coalesce(':' || x.non_prevenu, ''), ',' order by x.id), '')
    from public.demande_destinataires x where x.demande_id = %s$cc_q$, p_id));
$cc_dd$;

-- La ligne d'émargement d'un personnage sur une feuille : « absent|origine|observation|signée », ou « aucune ligne ».
create or replace function pg_temp.ligne(p_seance text, p_qui text)
returns text language sql as $cc_li$
  select coalesce(pg_temp.calcul(format($cc_q$select concat_ws('|', absent::text, coalesce(absence_origine, '-'), coalesce(observation, '-'), (trace is not null)::text)
      from public.emargement_lignes where seance_id = %s and stagiaire_id = %s$cc_q$, p_seance, pg_temp.stag(p_qui))), 'aucune ligne');
$cc_li$;

-- md5(pg_get_functiondef) des seize fonctions que la migration 4 redéfinit : « signature=md5;... ».
create or replace function pg_temp.md5_seize()
returns text language sql as $cc_m5$
  select coalesce(string_agg(p.oid::regprocedure::text || '=' || md5(pg_get_functiondef(p.oid)), ';' order by p.oid::regprocedure::text), 'aucune')
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('coordonnees_promo', 'ordonner_fiches', 'regler_financements', '_contact_formateurs_du_jour', '_contact_possibles',
                       'ecrire_a', 'ecrire_au_stagiaire', 'reglages_contact', '_contact_srv_resultat', '_contact_srv_jeton',
                       '_contact_effacer_stagiaire',
                       '_contact_annexes', 'prevenir_absence', 'regler_justificatif', '_contact_premarquer', '_contact_emargement_absence');
$cc_m5$;

-- Le texte d'une fonction (pg_get_functiondef), ou « absente ».
create or replace function pg_temp.texte_de(p_sig text)
returns text language sql as $cc_tx$
  select coalesce(pg_temp.calcul(format('select pg_get_functiondef(%L::regprocedure)', p_sig)), 'absente');
$cc_tx$;

-- Un texte (migration, retour) joué puis TOUJOURS annulé : « refusée <état> <message> », ou « acceptée (annulée) ».
create or replace function pg_temp.essayer_et_annuler(p_sql text)
returns text language plpgsql as $cc_en$
begin
  begin
    execute p_sql;
    raise exception using errcode = 'P0001', message = 'CC_ACCEPTEE';
  exception when others then
    if sqlerrm = 'CC_ACCEPTEE' then
      return 'acceptée (annulée)';
    end if;
    return 'refusée ' || sqlstate || ' ' || left(sqlerrm, 200);
  end;
end $cc_en$;

-- Les personnages de cette preuve, posés après les migrations : stag_a, stag_b (promo 1, avec compte) ; stag_y (promo 1, sans compte) ;
-- une promo d'essai du centre de la promo 1 et deux stagiaires sans compte : stag_x (délégué titulaire) et stag_z ; t_regl (direction
-- de Nîmes, titre non fixe sans case, que le groupe reglages passe à « Réglages : Voir ») ; form_n au planning du jeudi 19 novembre au matin (une ligne profs rattachée à sa
-- fiche) ; aucune règle dans le centre de la promo 1 (mode choix). Si une pose échoue (contre-épreuve), une ligne d'information le dit.
create or replace function pg_temp.poser_correctifs()
returns void language plpgsql as $cc_po$
declare
  r record;
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_p integer;
  v_s integer;
  v_prof integer;
  v_email text;
  v_titre text;
begin
  insert into public.promos (nom, lieu_id, date_debut) values ('Preuve16 promo', v_l1, date '2026-09-07') returning id into v_p;
  for r in select * from (values (60, 'stag_a', 1, null::text, true), (61, 'stag_b', 1, null, true), (62, 'stag_y', 1, null, false),
                                 (63, 'stag_x', null, 'titulaire', false), (64, 'stag_z', null, null, false)) x(ordre, nom, promo, delegue, compte) loop
    v_email := 'preuve16.' || replace(r.nom, '_', '.') || '@exemple.invalid';
    execute format('insert into public.stagiaires (prenom, nom, ordre, promo_id, delegue) values (%L, %L, 990, %s, %L) returning id',
                   'Preuve16 ' || r.nom, 'PREUVE', coalesce(r.promo, v_p), r.delegue) into v_s;
    insert into pg_temp.perso (ordre, nom, email, role, info) values (r.ordre, r.nom, v_email, 'stagiaire', v_s::text);
    if r.compte then
      insert into public.user_profiles (email, role, is_admin, stagiaire_id) values (v_email, 'stagiaire', false, v_s);
    end if;
  end loop;
  insert into pg_temp.perso (ordre, nom, email, role) values (65, 't_regl', 'preuve16.t.regl@exemple.invalid', 'prof');
  insert into public.user_profiles (email, role, is_admin) values ('preuve16.t.regl@exemple.invalid', 'prof', false);
  v_titre := pg_temp.nouveau_titre('Preuve16 réglages en lecture', 'centre', v_l1);
  update pg_temp.perso set info = v_titre where nom = 't_regl';
  perform pg_temp.affecter('preuve16.t.regl@exemple.invalid', 'direction', null, v_l1, v_titre);
  insert into public.profs (nom, ordre) values ('Preuve16 form_n', 995) returning id into v_prof;
  update public.contacts set prof_id = v_prof where id = (select fiche_id from pg_temp.cles where cle = 'form_n');
  insert into public.planning_entries (promo_id, semaine_lundi, day_index, half_day, slot, prof_id) values (1, date '2026-11-16', 3, 'matin', 960, v_prof);
  delete from public.contact_regles where lieu_id = v_l1;
exception when others then
  perform pg_temp.informer('personnages des correctifs', 'pose impossible : ' || sqlstate || ' ' || left(sqlerrm, 160));
end $cc_po$;

-- Groupe envois (1). Une demande de stag_a à form_n crée un envoi « nouvelle » ; sa prise par la fonction serveur est simulée en
-- propriétaire (en_cours, tentatives + 1, comme _contact_srv_prendre), un jeton posé par _contact_srv_jetons (service_role).
create or replace function pg_temp.groupe_envois()
returns void language plpgsql as $cc_ge$
declare
  v_id text;
  v_e text;
  c_prise constant text := $cc_q$update public.contact_envois set etat = 'en_cours', tentatives = tentatives + 1, raison = null,
      prochain_essai_le = public._contact_maintenant() + interval '10 minutes' where id = %s$cc_q$;
  c_etat constant text := $cc_q$select concat_ws('|', e.etat, e.tentatives, coalesce(to_char(e.prochain_essai_le - public._contact_maintenant(), 'HH24:MI'), '-'),
      coalesce(e.raison, '-'), (select count(*) from public.contact_jetons j where j.envoi_id = e.id)) from public.contact_envois e where e.id = %s$cc_q$;
begin
  perform pg_temp.horloge('2026-11-18 10:00');
  v_id := pg_temp.id_rendu(pg_temp.appeler('stag_a', '1', format('select public.ecrire_a(%s, %L, %L, null)::text', pg_temp.fiche('form_n'), 'autre', 'Preuve16 envoi')));
  v_e := pg_temp.calcul(format('select max(id)::text from public.contact_envois where demande_id = %s', v_id));
  perform pg_temp.essai(format(c_prise, v_e));
  perform pg_temp.srv_geste(format($cc_q$select public._contact_srv_jetons(%s, '[{"hash": "%s", "action": "voir"}]'::jsonb)$cc_q$, v_e, repeat('ab', 32)));
  perform pg_temp.attendre('envois', 'l''envoi pris (simulé) : en cours, tentative 1, un jeton',
    pg_temp.calcul(format(c_etat, v_e)), 'en_cours|1|00:10|-|1');
  perform pg_temp.attendre('envois', '_contact_srv_resultat(limite) : à retenter dans 5 minutes, tentative rendue (0), raison gardée, jeton retiré',
    pg_temp.srv_geste(format($cc_q$select public._contact_srv_resultat(%s, 'limite', 'Resend 429 quota')$cc_q$, v_e))
      || ' / ' || pg_temp.calcul(format(c_etat, v_e)),
    'fait / a_retenter|0|00:05|Resend 429 quota|0');
  perform pg_temp.attendre('envois', 'limite sur un envoi qui n''est plus en cours : rien ne change',
    pg_temp.srv_geste(format($cc_q$select public._contact_srv_resultat(%s, 'limite', 'encore')$cc_q$, v_e))
      || ' / ' || pg_temp.calcul(format(c_etat, v_e)),
    'fait / a_retenter|0|00:05|Resend 429 quota|0');
  -- La reprise : c'est de nouveau sa première tentative ; un échec la remet « à retenter » (et non en échec définitif).
  perform pg_temp.essai(format(c_prise, v_e));
  perform pg_temp.attendre('envois', 'reprise après la limite : tentative 1 ; un échec la remet à retenter (la limite n''a rien consommé)',
    pg_temp.srv_geste(format($cc_q$select public._contact_srv_resultat(%s, 'echec', 'Resend 500')$cc_q$, v_e))
      || ' / ' || pg_temp.calcul(format(c_etat, v_e)),
    'fait / a_retenter|1|00:05|Resend 500|0');
  -- Le 429 durable (relecture finale, I3) : l'âge de l'envoi se juge sur son cree_le (posé par _contact_maintenant() à la création).
  -- Témoin : créé il y a 23 heures, « limite » le remet encore à retenter, tentative rendue.
  perform pg_temp.essai(format($cc_q$update public.contact_envois set cree_le = public._contact_maintenant() - interval '23 hours' where id = %s$cc_q$, v_e));
  perform pg_temp.essai(format(c_prise, v_e));
  perform pg_temp.attendre('envois', 'témoin : un envoi créé il y a 23 heures reste à retenter sous « limite », tentative rendue (1)',
    pg_temp.srv_geste(format($cc_q$select public._contact_srv_resultat(%s, 'limite', 'Resend 429 quota')$cc_q$, v_e))
      || ' / ' || pg_temp.calcul(format(c_etat, v_e)),
    'fait / a_retenter|1|00:05|Resend 429 quota|0');
  perform pg_temp.essai(format($cc_q$update public.contact_envois set cree_le = public._contact_maintenant() - interval '25 hours' where id = %s$cc_q$, v_e));
  perform pg_temp.essai(format(c_prise, v_e));
  perform pg_temp.srv_geste(format($cc_q$select public._contact_srv_jetons(%s, '[{"hash": "%s", "action": "voir"}]'::jsonb)$cc_q$, v_e, repeat('ab', 32)));
  perform pg_temp.attendre('envois', 'un envoi créé il y a plus de 24 heures : « limite » le passe en échec (raison claire, tentative gardée, jeton retiré, plus de prochain essai) : il se voit',
    pg_temp.srv_geste(format($cc_q$select public._contact_srv_resultat(%s, 'limite', 'Resend 429 quota')$cc_q$, v_e))
      || ' / ' || pg_temp.calcul(format(c_etat, v_e)),
    'fait / echec|2|-|Resend 429 durable : non parti après 24 h|0');
  perform pg_temp.attendre('envois', 'l''envoi en échec par le 429 durable se voit : « E-mail non parti » pour form_n, destinataire (envoi_en_echec de liste_demandes)',
    pg_temp.appeler('form_n', '1', format($cc_q$select coalesce((select envoi_en_echec::text from public.liste_demandes() where id = %s), 'absente')$cc_q$, v_id)),
    'OK true');
end $cc_ge$;

-- Groupe liens (8). Mercredi 18 novembre : une demande de stag_a à sec_n (fiche sans compte de Nîmes) ; deux jetons de sec_n posés en
-- propriétaire (comme _contact_srv_jetons, sans envoi) : lecture (voir) et geste (prise). La fonction serveur les juge en service_role.
create or replace function pg_temp.groupe_liens()
returns void language plpgsql as $cc_gl$
declare
  f_sec text := pg_temp.fiche('sec_n');
  v_id text;
  h_voir constant text := repeat('5a', 32);
  h_prise constant text := repeat('5b', 32);
  c_lien constant text := $cc_q$select case when r ? 'invalide' then 'invalide' when r ? 'demande' then 'demande' else r::text end
    from (select public._contact_srv_lien(%L) r) x$cc_q$;
  c_agir constant text := $cc_q$select case when r ? 'invalide' then 'invalide' when r ? 'fait' then 'fait' when r ? 'deja' then 'deja' else r::text end
    from (select public._contact_srv_agir(%L) r) x$cc_q$;
begin
  perform pg_temp.horloge('2026-11-18 10:00');
  v_id := pg_temp.id_rendu(pg_temp.appeler('stag_a', '1', format('select public.ecrire_a(%s, %L, %L, null)::text', f_sec, 'autre', 'Preuve16 lien')));
  perform pg_temp.essai(format($cc_q$insert into public.contact_jetons (hash, demande_id, fiche_id, action, expire_le)
      values (decode(%L, 'hex'), %s, %s, 'voir', public._contact_maintenant() + interval '14 days'),
             (decode(%L, 'hex'), %s, %s, 'prise', public._contact_maintenant() + interval '14 days')$cc_q$, h_voir, v_id, f_sec, h_prise, v_id, f_sec));
  perform pg_temp.attendre('liens', 'témoin : sec_n, présente, lit la demande par son lien',
    pg_temp.srv(format('select to_jsonb((%s))', format(c_lien, h_voir))) #>> '{}', 'demande');
  perform pg_temp.essai(format($cc_q$update public.contacts set depart_le = '2026-11-17' where id = %s$cc_q$, f_sec));
  perform pg_temp.attendre('liens', 'sec_n partie (départ le 17, nous sommes le 18) : son lien de lecture et son lien de geste sont invalides, la demande n''est pas prise',
    (pg_temp.srv(format('select to_jsonb((%s))', format(c_lien, h_voir))) #>> '{}') || ' / '
      || (pg_temp.srv(format('select to_jsonb((%s))', format(c_agir, h_prise))) #>> '{}') || ' / '
      || pg_temp.calcul(format('select etat from public.demandes where id = %s', v_id)),
    'invalide / invalide / envoyee');
  perform pg_temp.essai(format($cc_q$update public.contacts set depart_le = '2026-11-18' where id = %s$cc_q$, f_sec));
  perform pg_temp.attendre('liens', 'le jour de son départ (le 18), sec_n lit encore la demande et fait le geste par son lien',
    (pg_temp.srv(format('select to_jsonb((%s))', format(c_lien, h_voir))) #>> '{}') || ' / '
      || (pg_temp.srv(format('select to_jsonb((%s))', format(c_agir, h_prise))) #>> '{}'),
    'demande / fait');
  perform pg_temp.essai(format('update public.contacts set depart_le = null where id = %s', f_sec));
  perform pg_temp.essai('delete from public.demandes where auteur_stagiaire_id = ' || pg_temp.stag('stag_a'));
end $cc_gl$;

-- Groupe reglages (2). Aujourd'hui un titre ne peut pas porter « Réglages : Voir » (_cases_valides le refuse : non ou modifier) ; la
-- lecture sans écriture que reglages_contact admet (case_centre >= 1) se pose donc ici en contournant _cases_valides le temps d'une mise
-- à jour (définition relue par pg_get_functiondef, rendue aussitôt, contrôlée par md5).
create or replace function pg_temp.groupe_reglages()
returns void language plpgsql as $cc_gr$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_def text := pg_temp.calcul($cc_q$select pg_get_functiondef('public._cases_valides(text, jsonb)'::regprocedure)$cc_q$);
begin
  perform pg_temp.essai($cc_q$create or replace function public._cases_valides(p_niveau text, p_cases jsonb) returns boolean language sql
    as 'select true'$cc_q$);
  perform pg_temp.essai(format('update public.titres set cases = %L::jsonb where id = %s', '{"reglages":"voir"}', (select info from pg_temp.perso where nom = 't_regl')));
  perform pg_temp.essai(v_def);
  perform pg_temp.attendre('reglages', 'mise en place : t_regl a « Réglages : Voir » dans son centre ; _cases_valides rendu à sa définition',
    pg_temp.appeler('t_regl', '1', format('select public.case_centre(%s, ''reglages'')::text', v_l1)) || ' / '
      || pg_temp.calcul(format($cc_q$select (md5(pg_get_functiondef('public._cases_valides(text, jsonb)'::regprocedure)) = md5(%L))::text$cc_q$, v_def)),
    'OK 1 / true');
  perform pg_temp.attendre('reglages', 'reglages_contact(Nîmes) : peut_modifier vrai pour dir_n (Réglages : Modifier), faux pour t_regl (Réglages : Voir)',
    pg_temp.appeler('dir_n', '1', format($cc_q$select coalesce(public.reglages_contact(%s) ->> 'peut_modifier', 'absente')$cc_q$, v_l1)) || ' / '
      || pg_temp.appeler('t_regl', '1', format($cc_q$select coalesce(public.reglages_contact(%s) ->> 'peut_modifier', 'absente')$cc_q$, v_l1)),
    'OK true / OK false');
  perform pg_temp.attendre('reglages', 't_regl lit les réglages (règles, réponses) mais ne les écrit pas : la base le refuse, comme l''écran le dit d''avance',
    pg_temp.appeler('t_regl', '1', format($cc_q$select jsonb_typeof(public.reglages_contact(%s) -> 'reponses')$cc_q$, v_l1)) || ' / '
      || pg_temp.appeler('t_regl', '1', format('select public.regler_reponses(%s, %L)::text', v_l1, '[]')),
    'OK array / ERREUR 42501 contact: Réservé aux réglages du centre.');
end $cc_gr$;

-- Groupe indisponibles (3). Mercredi 18 novembre, 18 h : form_n est au planning du jeudi 19 matin ; aucune règle (mode choix).
create or replace function pg_temp.groupe_indisponibles()
returns void language plpgsql as $cc_gi$
declare
  f_form_n text := pg_temp.fiche('form_n');
  f_dir_n text := pg_temp.fiche('dir_n');
  v text;
  c_apercu constant text := $cc_q$select concat_ws('|', a ->> 'mode',
      coalesce((select x ->> 'pre_coche' from jsonb_array_elements(a -> 'possibles') x where x ->> 'fiche_id' = %1$L), 'absent'),
      (select count(*) from jsonb_array_elements(a -> 'annexes' -> 'formateurs') x where x ->> 'fiche_id' = %1$L),
      coalesce((select string_agg(x ->> 'nom', ',') from jsonb_array_elements(a -> 'annexes' -> 'non_prevenus') x where x ->> 'nom' like 'Preuve16%%'), 'aucun'))
    from (select public.apercu_envoi('absence', '[{"jour":"2026-11-19","demi":"matin"}]'::jsonb) a) s$cc_q$;
begin
  perform pg_temp.horloge('2026-11-18 18:00');
  perform pg_temp.attendre('indisponibles', 'témoin : form_n disponible, au planning du jeudi 19 matin, est proposé et pré-coché à stag_a',
    pg_temp.appeler('stag_a', '1', format(c_apercu, f_form_n)), 'OK choix|true|0|aucun');
  perform pg_temp.essai(format($cc_q$update public.contacts set conge_du = '2026-11-18', conge_au = '2026-11-30' where id = %s$cc_q$, f_form_n));
  perform pg_temp.attendre('indisponibles', 'form_n en congé : ni proposé ni pré-coché, ni prévenu en annexe ; son nom est dans les non prévenus de l''aperçu',
    pg_temp.appeler('stag_a', '1', format(c_apercu, f_form_n)), 'OK choix|absent|0|Preuve16 form_n');
  v := pg_temp.id_rendu(pg_temp.prevenir('stag_a', '2026-11-19', 'matin', 'famille', format('array[%s]::bigint[]', f_dir_n)));
  perform pg_temp.attendre('indisponibles', 'stag_a prévient (jeudi 19 matin, dir_n choisi) : form_n, en congé, n''est pas prévenu en annexe ; son nom y est, « non prévenu », sans envoi',
    pg_temp.calcul(format('select count(*)::text from public.demande_destinataires where demande_id = %s and fiche_id = %s', v, f_form_n))
      || ' / ' || pg_temp.calcul(format('select count(*)::text from public.contact_envois where demande_id = %s and vers_fiche_id = %s', v, f_form_n))
      || ' / ' || pg_temp.calcul(format($cc_q$select string_agg(annexe || ':' || non_prevenu, ',') from public.demande_destinataires
           where demande_id = %s and non_prevenu like 'Preuve16%%'$cc_q$, v)),
    '0 / 0 / formateur_du_jour:Preuve16 form_n');
  perform pg_temp.attendre('indisponibles', 'form_n choisi en congé : refusé (il n''est plus dans la liste)',
    pg_temp.prevenir('stag_a', '2026-11-20', 'matin', 'famille', format('array[%s]::bigint[]', f_form_n)),
    'ERREUR 42501 contact: Cette personne ne peut pas recevoir ta demande.');
  perform pg_temp.essai(format($cc_q$update public.contacts set conge_du = null, conge_au = null, depart_le = '2026-11-17' where id = %s$cc_q$, f_form_n));
  perform pg_temp.attendre('indisponibles', 'form_n parti (départ le 17) : ni proposé ni pré-coché ; son nom dans les non prévenus',
    pg_temp.appeler('stag_a', '1', format(c_apercu, f_form_n)), 'OK choix|absent|0|Preuve16 form_n');
  perform pg_temp.essai(format('update public.contacts set depart_le = null where id = %s', f_form_n));
  perform pg_temp.essai('delete from public.demandes where auteur_stagiaire_id = ' || pg_temp.stag('stag_a'));
end $cc_gi$;

-- Groupe quota (4). Mercredi 18 novembre : form_n crée 30 conversations (ecrire_a vers dir_n), la 31e est refusée.
create or replace function pg_temp.groupe_quota()
returns void language plpgsql as $cc_gq$
declare
  f_form_n text := pg_temp.fiche('form_n');
  f_dir_n text := pg_temp.fiche('dir_n');
  v text;
  v_premiere text;
  v_ok integer := 0;
  i integer;
begin
  perform pg_temp.horloge('2026-11-18 11:00');
  for i in 1 .. 30 loop
    v := pg_temp.appeler('form_n', '1', format('select public.ecrire_a(%s, null, %L, null)::text', f_dir_n, 'Preuve16 quota ' || i));
    if v ~ '^OK [0-9]+$' then
      v_ok := v_ok + 1;
      if i = 1 then v_premiere := pg_temp.id_rendu(v); end if;
    end if;
  end loop;
  perform pg_temp.attendre('quota', 'form_n crée 30 conversations le même jour : toutes acceptées', v_ok::text, '30');
  perform pg_temp.attendre('quota', 'l''index du quota (demandes_auteur_fiche_cree : auteur_fiche_id, cree_le) existe',
    pg_temp.calcul($cc_q$select coalesce((select pg_get_indexdef(to_regclass('public.demandes_auteur_fiche_cree'))), 'absent')$cc_q$),
    'CREATE INDEX demandes_auteur_fiche_cree ON public.demandes USING btree (auteur_fiche_id, cree_le) WHERE (auteur_fiche_id IS NOT NULL)');
  perform pg_temp.attendre('quota', 'la 31e (ecrire_a), puis ecrire_au_stagiaire : refusées, phrase vouvoyée',
    pg_temp.appeler('form_n', '1', format('select public.ecrire_a(%s, null, %L, null)::text', f_dir_n, 'Preuve16 quota 31')) || ' / '
      || pg_temp.appeler('form_n', '1', format('select public.ecrire_au_stagiaire(%s, %L, null)::text', pg_temp.stag('stag_a'), 'Preuve16 quota 32')),
    'ERREUR P0001 contact: Vous avez atteint la limite de 30 nouveaux messages pour aujourd''hui. / ERREUR P0001 contact: Vous avez atteint la limite de 30 nouveaux messages pour aujourd''hui.');
  perform pg_temp.attendre('quota', 'une réponse dans une conversation existante ne compte pas : form_n répond ; dir_n garde son propre quota',
    pg_temp.appeler('form_n', '1', format('select (public.repondre_demande(%s, %L) is not null)::text', v_premiere, 'Preuve16 réponse')) || ' / '
      || (pg_temp.appeler('dir_n', '1', format('select public.ecrire_a(%s, null, %L, null)::text', f_form_n, 'Preuve16 quota dir_n')) ~ '^OK [0-9]+$')::text,
    'OK true / true');
  perform pg_temp.horloge('2026-11-19 09:00');
  perform pg_temp.attendre('quota', 'le lendemain, form_n écrit de nouveau',
    (pg_temp.appeler('form_n', '1', format('select public.ecrire_a(%s, null, %L, null)::text', f_dir_n, 'Preuve16 quota lendemain')) ~ '^OK [0-9]+$')::text, 'true');
  perform pg_temp.essai('delete from public.demandes where auteur_fiche_id in (' || f_form_n || ', ' || f_dir_n || ')');
end $cc_gq$;

-- Groupe absences (5).
create or replace function pg_temp.groupe_absences()
returns void language plpgsql as $cc_ga$
declare
  f_dir_n text := pg_temp.fiche('dir_n');
  v_choix text := format('array[%s]::bigint[]', pg_temp.fiche('dir_n'));
  v_jour_def text;
  v_seance text;
  v text;
  v_n text;
begin
  perform pg_temp.horloge('2026-11-18 18:00');
  -- 120 jours : le jeudi 18 mars 2027 est le 120e jour après le mercredi 18 novembre 2026.
  perform pg_temp.attendre('absences', 'prevenir_absence : 121 jours à l''avance refusé ; 120 jours accepté',
    pg_temp.prevenir('stag_a', '2027-03-19', 'matin', 'demarche', v_choix) || ' / '
      || (pg_temp.prevenir('stag_a', '2027-03-18', 'matin', 'demarche', v_choix) ~ '^OK [0-9]+$')::text,
    'ERREUR P0001 contact: Une absence se prévient au plus tôt 120 jours à l''avance. / true');
  -- Le droit avant le type : une demande de stag_a à dir_n (pas une absence) ; form_n, formateur de la promo, n'y a aucun rôle.
  v_n := pg_temp.id_rendu(pg_temp.appeler('stag_a', '1', format('select public.ecrire_a(%s, %L, %L, null)::text', f_dir_n, 'document', 'Preuve16 attestation')));
  perform pg_temp.attendre('absences', 'regler_justificatif sur une demande qui n''est pas une absence : form_n (aucun rôle) « introuvable » ; dir_n (destinataire) apprend le type',
    pg_temp.appeler('form_n', '1', format('select public.regler_justificatif(%s, %L)::text', v_n, 'recu')) || ' / '
      || pg_temp.appeler('dir_n', '1', format('select public.regler_justificatif(%s, %L)::text', v_n, 'recu')),
    'ERREUR 42501 contact: Demande introuvable. / ERREUR P0001 contact: Seule une absence a un justificatif.');
  perform pg_temp.attendre('absences', 'regler_justificatif sur une demande inexistante : « introuvable », comme pour form_n ci-dessus',
    pg_temp.appeler('form_n', '1', 'select public.regler_justificatif(-1, ''recu'')::text'), 'ERREUR 42501 contact: Demande introuvable.');
  perform pg_temp.essai('delete from public.demandes where auteur_stagiaire_id = ' || pg_temp.stag('stag_a'));

  -- La course avec une signature : la feuille du jeudi 19 matin, ouverte par form_n à 08:30 ; quand le pré-marquage de l'absence de stag_b
  -- insère sa ligne, une ligne signée vient d'être écrite (déclencheur d'essai, avant l'insertion) : le pré-marquage cède.
  v_jour_def := pg_temp.calcul($cc_q$select pg_get_functiondef('public.emargement_jour_paris()'::regprocedure)$cc_q$);
  perform pg_temp.essai($cc_q$delete from public.settings where promo_id = 1 and key = 'emargement_actif'$cc_q$);
  perform pg_temp.essai($cc_q$insert into public.settings (key, value, promo_id) values ('emargement_actif', 'true', 1)$cc_q$);
  perform pg_temp.essai($cc_q$create or replace function public.emargement_jour_paris() returns date language sql stable set search_path = public, pg_temp
    as 'select (coalesce(nullif(current_setting(''preuve.maintenant'', true), '''')::timestamptz, now()) at time zone ''Europe/Paris'')::date'$cc_q$);
  perform pg_temp.horloge('2026-11-19 08:30');
  v := pg_temp.appeler('form_n', '1', $cc_q$select public.emargement_ouvrir('matin', '09:00', '12:00')::text$cc_q$);
  perform pg_temp.verifier('absences', 'form_n ouvre la feuille du jeudi 19 matin (émargement allumé en propriétaire)', v ~ '^OK [0-9]+$', v);
  v_seance := pg_temp.id_rendu(v);
  perform pg_temp.essai($cc_q$create function public.preuve16_course() returns trigger language plpgsql as 'begin
      if current_setting(''preuve.course'', true) = ''oui'' then
        perform set_config(''preuve.course'', '''', true);
        insert into public.emargement_lignes (seance_id, promo_id, stagiaire_id, trace, signe_le, signe_par)
          values (new.seance_id, new.promo_id, new.stagiaire_id, ''M1 1L2 2'', now(), ''preuve16.course@exemple.invalid'');
      end if;
      return new;
    end'$cc_q$);
  perform pg_temp.essai('create trigger preuve16_course before insert on public.emargement_lignes for each row execute function public.preuve16_course()');
  perform set_config('preuve.course', 'oui', true);
  v := pg_temp.prevenir('stag_b', '2026-11-19', 'matin', 'transport', v_choix);
  perform set_config('preuve.course', '', true);
  perform pg_temp.attendre('absences', 'une signature écrite au même instant que le pré-marquage : l''absence est prévenue (pas d''erreur 23505), la ligne signée reste telle quelle',
    (v ~ '^OK [0-9]+$')::text || ' / ' || pg_temp.ligne(v_seance, 'stag_b'), 'true / false|-|-|true');
  perform pg_temp.essai('drop trigger preuve16_course on public.emargement_lignes');
  perform pg_temp.essai('drop function public.preuve16_course()');
  perform pg_temp.essai(format('delete from public.emargement_seances where id = %s', v_seance));
  perform pg_temp.essai(v_jour_def);
  perform pg_temp.attendre('absences', 'ménage : feuille d''essai et déclencheur d''essai supprimés, emargement_jour_paris rendu à sa définition',
    pg_temp.calcul(format($cc_q$select concat_ws('|', (select count(*) from public.emargement_seances where id = %s),
        (to_regprocedure('public.preuve16_course()') is null)::text,
        (md5(pg_get_functiondef('public.emargement_jour_paris()'::regprocedure)) = md5(%L))::text)$cc_q$, v_seance, v_jour_def)),
    '0|true|true');
  -- Le verrou du chemin du justificatif : il ne se montre pas dans une seule session ; le texte de la fonction le porte.
  perform pg_temp.verifier('absences', 'le chemin du justificatif lit les feuilles de l''absence sous verrou (for share) avant de toucher une ligne',
    pg_temp.texte_de('public._contact_emargement_absence()') ~ 'from emargement_seances s where s\.promo_id = new\.promo_id and s\.jour between new\.du and new\.au order by s\.id for share;',
    left(pg_temp.texte_de('public._contact_emargement_absence()'), 60));
  perform pg_temp.essai('delete from public.demandes where auteur_stagiaire_id = ' || pg_temp.stag('stag_b'));
end $cc_ga$;

-- Groupe annuaire (6).
create or replace function pg_temp.groupe_annuaire()
returns void language plpgsql as $cc_gn$
declare
  v_l1 integer := (select lieu_id from public.promos where id = 1);
  v_l2 integer := (select lieu_id from public.promos where id = 2);
  s_y text := pg_temp.stag('stag_y');
  s_x text := pg_temp.stag('stag_x');
  v_partagee text;
  c_coord constant text := 'select count(*)::text from public.coordonnees_promo() where stagiaire_id = %s';
begin
  perform pg_temp.horloge('2026-11-18 10:00');
  perform pg_temp.attendre('annuaire', 'témoin : coordonnees_promo() rend la fiche de stag_y (promo 1) à form_n',
    pg_temp.appeler('form_n', '1', format(c_coord, s_y)), 'OK 1');
  perform pg_temp.calcul(format('select (public._effacer_etape1(%s) is not null)::text', s_y));
  perform pg_temp.attendre('annuaire', 'stag_y effacé (étape 1) : coordonnees_promo() ne rend plus sa ligne',
    pg_temp.calcul(format('select (efface_le is not null)::text from public.stagiaires where id = %s', s_y)) || ' / '
      || pg_temp.appeler('form_n', '1', format(c_coord, s_y)),
    'true / OK 0');
  perform pg_temp.calcul(format('select (public._effacer_etape1(%s) is not null)::text', s_x));
  perform pg_temp.attendre('annuaire', 'stag_x, délégué titulaire de sa promo, effacé (étape 1) : sa marque de délégué est vidée',
    pg_temp.calcul(format('select concat_ws(''|'', (efface_le is not null)::text, coalesce(delegue, ''aucune'')) from public.stagiaires where id = %s', s_x)),
    'true|aucune');
  -- Une fiche sans compte née à Montpellier (promo 2), partagée avec Nîmes.
  v_partagee := pg_temp.calcul(format($cc_q$insert into public.contacts (prenom, role, email, category, sort_order, lieu_id, lieux_partages)
      values ('Preuve16 partagée', 'Secrétariat', 'preuve16.partagee@exemple.invalid', 'admin', 991, %s, array[%s]) returning id::text$cc_q$, v_l2, v_l1));
  -- La liste entière de l'annuaire, comme l'écran l'envoie (« Monter / Descendre ») : form_n, la fiche partagée, sec_n.
  perform pg_temp.attendre('annuaire', 'ordonner_fiches (form_n, Nîmes) : la liste entière avec la fiche de Montpellier partagée est acceptée ; form_n et sec_n rangés (10, 30), la fiche partagée garde son ordre (991)',
    pg_temp.appeler('form_n', '1', format('select public.ordonner_fiches(array[%s, %s, %s])::text', pg_temp.fiche('form_n'), v_partagee, pg_temp.fiche('sec_n')))
      || ' / ' || pg_temp.calcul(format('select string_agg(sort_order::text, ''|'' order by array_position(array[%s, %s, %s]::bigint[], id)) from public.contacts where id in (%s, %s, %s)',
           pg_temp.fiche('form_n'), v_partagee, pg_temp.fiche('sec_n'), pg_temp.fiche('form_n'), v_partagee, pg_temp.fiche('sec_n'))),
    'OK 2 / 10|991|30');
  perform pg_temp.attendre('annuaire', 'ordonner_fiches : la fiche partagée seule ne change rien (OK 0) ; une fiche d''un autre centre non partagée (form_m) reste refusée',
    pg_temp.appeler('form_n', '1', format('select public.ordonner_fiches(array[%s])::text', v_partagee)) || ' / '
      || pg_temp.appeler('form_n', '1', format('select public.ordonner_fiches(array[%s])::text', pg_temp.fiche('form_m'))),
    'OK 0 / ERREUR 42501 contact: Une fiche n''est pas de ce centre.');
  -- Le rattrapage de la migration 4 : un stagiaire effacé AVANT elle (posé avant la migration 4, hors du mode en ligne) n'est plus délégué.
  if coalesce(current_setting('preuve.ancien_delegue', true), '') = '' then
    perform pg_temp.informer('annuaire', 'rattrapage des délégués déjà effacés : non jugeable (mode en ligne, migration déjà appliquée)');
  else
    perform pg_temp.attendre('annuaire', 'rattrapage : un stagiaire effacé avant la migration 4, délégué titulaire, n''est plus délégué',
      pg_temp.calcul(format('select coalesce(delegue, ''aucune'') from public.stagiaires where id = %s', current_setting('preuve.ancien_delegue', true))),
      'aucune');
  end if;
  -- Le verrou de regler_financements : il ne se montre pas dans une seule session ; le texte de la fonction le porte, avant le contrôle.
  perform pg_temp.verifier('annuaire', 'regler_financements verrouille les financements du centre (for update) avant le contrôle « choisi pour un stagiaire » et la suppression',
    pg_temp.texte_de('public.regler_financements(integer, jsonb)')
      ~ 'perform 1 from contact_financements f where f\.lieu_id = p_lieu_id order by f\.id for update;.*Un financement choisi pour un stagiaire.*delete from contact_financements',
    left(pg_temp.texte_de('public.regler_financements(integer, jsonb)'), 60));
end $cc_gn$;

-- Groupe demandes (7).
create or replace function pg_temp.groupe_demandes()
returns void language plpgsql as $cc_gd$
declare
  s_z text := pg_temp.stag('stag_z');
  v_m text;
begin
  perform pg_temp.horloge('2026-11-18 10:00');
  perform pg_temp.attendre('demandes', 'ecrire_au_stagiaire par un stagiaire : refus tutoyé ; par dir_n : accepté',
    pg_temp.appeler('stag_a', '1', format('select public.ecrire_au_stagiaire(%s, %L, null)::text', pg_temp.stag('stag_b'), 'Preuve16 entre stagiaires')) || ' / '
      || (pg_temp.appeler('dir_n', '1', format('select public.ecrire_au_stagiaire(%s, %L, null)::text', pg_temp.stag('stag_b'), 'Preuve16 de dir_n')) ~ '^OK [0-9]+$')::text,
    'ERREUR 42501 contact: Tu ne peux écrire qu''à l''équipe de ton centre. / true');
  -- Une demande de stag_a à form_n ; stag_z y figure en annexe (cas futur : aujourd'hui seule une absence a des annexes stagiaires).
  v_m := pg_temp.id_rendu(pg_temp.appeler('stag_a', '1', format('select public.ecrire_a(%s, %L, %L, null)::text', pg_temp.fiche('form_n'), 'autre', 'Preuve16 annexe')));
  perform pg_temp.essai(format($cc_q$insert into public.demande_destinataires (demande_id, stagiaire_id, nom, principal, annexe) values (%s, %s, 'Preuve16 stag_z', false, 'delegue')$cc_q$, v_m, s_z));
  perform pg_temp.calcul(format('select (public._effacer_etape1(%s) is not null)::text', s_z));
  perform pg_temp.attendre('demandes', 'stag_z, seulement en annexe de la demande de stag_a, effacé : la demande de stag_a reste, sans la ligne de stag_z',
    pg_temp.calcul(format('select count(*)::text from public.demandes where id = %s', v_m)) || ' / ' || pg_temp.dest_de(v_m),
    '1 / ' || pg_temp.fiche('form_n') || ':P');
  perform pg_temp.attendre('demandes', '_contact_jours : entrées scalaire, tableau, objet sans jour : la phrase stricte (déjà vrai depuis la migration 2)',
    pg_temp.appeler('stag_a', '1', $cc_q$select public.apercu_envoi('absence', '[1]'::jsonb)::text$cc_q$) || ' / '
      || pg_temp.appeler('stag_a', '1', $cc_q$select public.apercu_envoi('absence', '[[1, 2]]'::jsonb)::text$cc_q$) || ' / '
      || pg_temp.appeler('stag_a', '1', $cc_q$select public.apercu_envoi('absence', '"lundi"'::jsonb)::text$cc_q$),
    'ERREUR P0001 contact: Les jours de ta demande sont illisibles : choisis chaque jour et sa demi-journée. / ERREUR P0001 contact: Les jours de ta demande sont illisibles : choisis chaque jour et sa demi-journée. / ERREUR P0001 contact: Les jours de ta demande sont illisibles : choisis chaque jour et sa demi-journée.');
  perform pg_temp.essai('delete from public.demandes where auteur_stagiaire_id = ' || pg_temp.stag('stag_a'));
end $cc_gd$;

-- Un groupe se joue-t-il dans ce mode ? Contre-épreuve : toujours (il doit être rouge). En ligne : seulement si p_condition (la
-- migration qui le fonde est appliquée), sinon une ligne d'information. Migrations injectées : toujours.
create or replace function pg_temp.groupe_a_jouer(p_groupe text, p_mode text, p_condition boolean, p_raison text)
returns boolean language plpgsql as $cc_gj$
begin
  if p_mode like 'contact-4-en-ligne%' and not coalesce(p_condition, false) then
    perform pg_temp.informer('groupe ' || p_groupe, 'sauté : ' || p_raison || ' (mode en ligne)');
    return false;
  end if;
  return true;
end $cc_gj$;

do $tpc4$
declare
  v_mode constant text :=
-- @@MODE@@
  ;
  v_debut constant timestamptz := clock_timestamp();
  v_en_ligne boolean;
  v_m4 text;
  v_r3 text;
  v_r4 text;
  v_etat1 text; v_etat1b text; v_etat2 text; v_etat3 text; v_etat4 text;
  v_retour4 text; v_retour3 text; v_retour2 text; v_retour1b text; v_retour1 text;
  v_av_regles text; v_av_fonctions text; v_av_droits text;
  v_ap_regles text; v_ap_fonctions text; v_ap_droits text;
  v_a4_regles text; v_a4_fonctions text; v_a4_droits text;
  v_r4_regles text; v_r4_fonctions text; v_r4_droits text;
  v_md5_avant4 text; v_md5_apres4 text; v_md5_retour4 text;
  v_jouees integer;
  v_partie4 boolean;
  v_refus text;
begin
  perform set_config('lock_timeout', '3s', true);
  v_en_ligne := v_mode like 'contact-4-en-ligne%';

  -- 1. Avant les migrations : l'empreinte de la base, puis les prérequis de l'état de départ (la production du 14/11).
  select e.regles, e.fonctions, e.droits into v_av_regles, v_av_fonctions, v_av_droits from pg_temp.empreinte() e;
  perform pg_temp.verifier('structure', 'prérequis : geste_promo(integer, text) existe (titres, migration 2)',
    to_regprocedure('public.geste_promo(integer, text)') is not null);
  perform pg_temp.verifier('structure', 'prérequis : _effacer_etape1(integer) existe (conservation)',
    to_regprocedure('public._effacer_etape1(integer)') is not null);
  perform pg_temp.verifier('structure', 'prérequis : contacts.lieu_id existe (20261113_contacts_centre)',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'contacts' and column_name = 'lieu_id'));

  -- 2. Les personnages, posés AVANT les migrations (comme les comptes de la production) : ceux du lot 4, des titres et la fiche sec_n.
  perform pg_temp.poser_contact();
  perform pg_temp.attendre('structure', 'les personnages sont posés (16 du lot 4, 5 des titres, la fiche sans compte sec_n)',
    pg_temp.calcul($cc_q$select concat_ws('/', (select count(*) from perso where ordre between 1 and 16)::text,
      (select count(*) from perso where ordre between 20 and 24)::text, (select count(*) from perso where nom = 'sec_n')::text)$cc_q$),
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
  v_etat3 := pg_temp.jouer('migration 3',
-- @@INJECTER supabase/migrations/20261115_contact_3_absences.sql@@
  );
  perform pg_temp.etape('migration 3', v_etat3, v_mode);
  -- L'horloge de la preuve (C-21) : _contact_maintenant() lit preuve.maintenant (annulé avec le reste). Posée avant le relevé « avant 4 ».
  if to_regprocedure('public._contact_maintenant()') is not null then
    execute $cc_q$create or replace function public._contact_maintenant() returns timestamptz language sql stable security definer
      set search_path = public, pg_temp as 'select coalesce(nullif(current_setting(''preuve.maintenant'', true), '''')::timestamptz, now())'$cc_q$;
  end if;
  select e.regles, e.fonctions, e.droits into v_a4_regles, v_a4_fonctions, v_a4_droits from pg_temp.empreinte() e;
  v_md5_avant4 := pg_temp.md5_seize();
  -- Un stagiaire effacé avant la migration 4, encore délégué titulaire (le rattrapage de la 4 doit vider sa marque) : promo d'essai du centre
  -- de la promo 1. Hors du mode en ligne (la migration y est déjà appliquée).
  perform set_config('preuve.ancien_delegue', '', true);
  if not v_en_ligne and to_regclass('public.absences_annoncees') is not null then
    perform set_config('preuve.ancien_delegue', pg_temp.calcul($cc_q$with p as (insert into public.promos (nom, lieu_id, date_debut)
        values ('Preuve16 promo ancienne', (select lieu_id from public.promos where id = 1), date '2026-01-05') returning id)
      insert into public.stagiaires (prenom, nom, ordre, promo_id, delegue) select 'Preuve16 ancien', 'PREUVE', 990, p.id, 'titulaire' from p
      returning id::text$cc_q$), true);
    perform pg_temp.calcul(format('select (public._effacer_etape1(%s) is not null)::text', current_setting('preuve.ancien_delegue', true)));
  end if;
  v_m4 :=
-- @@INJECTER supabase/migrations/20261116_contact_4_correctifs.sql@@
  ;
  v_etat4 := pg_temp.jouer('migration 4', v_m4);
  perform pg_temp.etape('migration 4', v_etat4, v_mode);
  v_md5_apres4 := pg_temp.md5_seize();

  -- 4. GROUPES de contrôles de la migration 4, chacun sauté avec une ligne d'information quand elle n'est pas encore appliquée (mode en
  --    ligne) ; dans la contre-épreuve, ils se jouent et doivent être rouges.
  perform pg_temp.poser_cles();
  perform pg_temp.poser_correctifs();
  v_partie4 := to_regprocedure('public._contact_quota_equipe(bigint)') is not null;
  if pg_temp.groupe_a_jouer('envois', v_mode, v_partie4, 'la migration 4 n''est pas appliquée') then
    perform pg_temp.groupe_envois();
  end if;
  if pg_temp.groupe_a_jouer('liens', v_mode, v_partie4, 'la migration 4 n''est pas appliquée') then
    perform pg_temp.groupe_liens();
  end if;
  if pg_temp.groupe_a_jouer('reglages', v_mode, v_partie4, 'la migration 4 n''est pas appliquée') then
    perform pg_temp.groupe_reglages();
  end if;
  if pg_temp.groupe_a_jouer('indisponibles', v_mode, v_partie4, 'la migration 4 n''est pas appliquée') then
    perform pg_temp.groupe_indisponibles();
  end if;
  if pg_temp.groupe_a_jouer('demandes', v_mode, v_partie4, 'la migration 4 n''est pas appliquée') then
    perform pg_temp.groupe_demandes();
  end if;
  if pg_temp.groupe_a_jouer('quota', v_mode, v_partie4, 'la migration 4 n''est pas appliquée') then
    perform pg_temp.groupe_quota();
  end if;
  if pg_temp.groupe_a_jouer('absences', v_mode, v_partie4, 'la migration 4 n''est pas appliquée') then
    perform pg_temp.groupe_absences();
  end if;
  if pg_temp.groupe_a_jouer('annuaire', v_mode, v_partie4, 'la migration 4 n''est pas appliquée') then
    perform pg_temp.groupe_annuaire();
  end if;
  perform set_config('preuve.maintenant', '', true);

  -- 5. Les retours, dans l'ordre inverse (4, 3, 2, 1b, 1). Avant le retour 4 : la migration 4 rejouée est refusée ; le retour 4 joué
  --    après le retour 3 (mauvais ordre) est refusé.
  v_r4 :=
-- @@INJECTER supabase/migrations/20261116_contact_4_correctifs_retour.sql@@
  ;
  v_r3 :=
-- @@INJECTER supabase/migrations/20261115_contact_3_absences_retour.sql@@
  ;
  if v_m4 = 'select 1' or v_en_ligne then
    perform pg_temp.informer('retour', 'migration 4 rejouée et garde du retour 4 : non jugeables (migration 4 non injectée)');
    if not v_en_ligne then
      perform pg_temp.verifier('retour', 'la migration 4 est injectée (contre-épreuve : non)', false, v_mode);
    end if;
  else
    perform pg_temp.attendre('retour', 'migration 4 rejouée : refusée par sa garde, rien n''est changé',
      pg_temp.essayer_et_annuler(v_m4),
      'refusée P0001 contact_4 : _contact_quota_equipe existe déjà, migration déjà appliquée ? rien n''est changé');
    v_refus := pg_temp.essayer_et_annuler(v_r3 || E'\n' || v_r4);
    perform pg_temp.verifier('retour', 'retour 4 joué après le retour 3 (mauvais ordre) : refusé par sa garde, qui dit quoi faire',
      v_refus like 'refusée P0001 contact\_4\_retour : la migration 3 n''est plus là (retour 3 joué avant celui-ci ?) : rejouer la migration 3, puis ce retour, puis le retour 3%', v_refus);
  end if;
  v_retour4 := pg_temp.jouer('retour 4', v_r4);
  perform pg_temp.etape('retour 4', v_retour4, v_mode);
  select e.regles, e.fonctions, e.droits into v_r4_regles, v_r4_fonctions, v_r4_droits from pg_temp.empreinte() e;
  v_md5_retour4 := pg_temp.md5_seize();
  if v_en_ligne then
    perform pg_temp.informer('retour 4', format('non jugeable (migrations déjà appliquées) ; md5 des seize fonctions : %s', v_md5_apres4));
  else
    perform pg_temp.verifier('retour', 'la migration 4 redéfinit les seize fonctions (md5 de pg_get_functiondef changé pour chacune)',
      v_md5_apres4 <> v_md5_avant4
        and (select bool_and(a.v <> b.v) from unnest(string_to_array(v_md5_avant4, ';')) with ordinality a(v, n)
               join unnest(string_to_array(v_md5_apres4, ';')) with ordinality b(v, n) on a.n = b.n)
        and array_length(string_to_array(v_md5_avant4, ';'), 1) = 16,
      'avant ' || v_md5_avant4 || ' ; après ' || v_md5_apres4);
    perform pg_temp.attendre('retour', 'après le retour 4 : md5(pg_get_functiondef) des seize fonctions égal à celui d''avant la migration 4', v_md5_retour4, v_md5_avant4);
    perform pg_temp.attendre('retour', 'après le retour 4 : l''index du quota est retiré', coalesce(to_regclass('public.demandes_auteur_fiche_cree')::text, 'absent'), 'absent');
    perform pg_temp.attendre('retour', 'après le retour 4 : empreinte regles égale à celle d''avant la migration 4', v_r4_regles, v_a4_regles);
    perform pg_temp.attendre('retour', 'après le retour 4 : empreinte fonctions égale à celle d''avant la migration 4', v_r4_fonctions, v_a4_fonctions);
    perform pg_temp.attendre('retour', 'après le retour 4 : empreinte droits égale à celle d''avant la migration 4', v_r4_droits, v_a4_droits);
  end if;
  v_retour3 := pg_temp.jouer('retour 3', v_r3);
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
  v_jouees := (v_etat1 = 'jouée')::integer + (v_etat2 = 'jouée')::integer + (v_etat3 = 'jouée')::integer + (v_etat4 = 'jouée')::integer;
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
end $tpc4$;
