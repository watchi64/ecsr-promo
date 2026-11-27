-- Preuve du chantier « cloisonnement par organisme » (spec docs/superpowers/specs/2026-11-27-cloisonnement-organismes-design.md,
-- § 5.6 ; plan docs/superpowers/plans/2026-11-27-cloisonnement-organismes.md). Une seule preuve pour les quatre migrations
-- 20261128_cloisonnement_<n> (1 fondations, 2a noyau, 2b siège et titres, 2c données) ; chaque tâche y ajoute ses groupes.
--   structure        chaque migration injectée se joue sans erreur ; chaque retour aussi.
--   fondations       (étape 1) l'existant sur l'organisme 1 (lignes d'avant la migration) ; organisme 1 = ECF BOUSCAREN,
--                    rédacteur, habillage égal à l'ancien réglage ; un rattachement par fondateur ; vocabulaire
--                    (organisme_de_lieu, organisme_de_promo, organisme_actif_fondateur, fondateur_sur, organisme_courant,
--                    est_siege_de, organisme_redacteur_courant) ; mon_organisme() rend ECF aux personnages d'ECF, B à ceux
--                    de B ; organismes_pour_support() refusée (42501) à tous sauf au fondateur ; fonctions security definer
--                    au chemin de recherche fixé, droits d'exécution et de table ; à la fin, aucune ligne sans organisme.
--   support-journal  (étape 1) le journal du fondateur : motif court ou blanc, durée nulle, négative ou de 3 h, organisme du
--                    rattachement ou inconnu refusés (22023), non-fondateur refusé (42501) ; un support ouvert ferme le
--                    précédent ; modification du motif, suppression, TRUNCATE, ferme_le vers le futur refusés ; fermeture
--                    anticipée acceptée ; lecture : le fondateur tout, le siège de l'organisme de la ligne ses lignes.
--   remplissage      (étape 1, Review Focus 1 : l'ancienne app insère sans organisme_id) lieux, profs, qcm_signalements,
--                    ressources (et affectations siège, titres réseau) : chaque ligne prend l'organisme de son auteur, ECF ou
--                    B ; le propriétaire et service_role prennent l'organisme unique tant que B n'existe pas ; ensuite, sans
--                    contexte : refus « Organisme introuvable pour cette ligne. » (22023).
--   equivalence-ecf  (étape 2a) avec ECF seul (B pas encore posé), chaque prédicat et geste du noyau (est_formateur,
--                    est_direction, est_siege, peut_acceder_promo, mes_promos, promo_par_defaut, promo_courante, cases,
--                    gestes, *_fixe, membre_stagiaire) rend, après les migrations, ce qu'il rendait avant l'étape 2a, pour chaque
--                    personnage de titres-aides (poser_perso), le fondateur réel et l'anonyme, dans 14 contextes : 0 écart.
--   noyau            (étape 2a) chaque personnage d'ECF et de B : est_formateur, est_direction, est_siege, peut_acceder_promo
--                    vrais seulement chez soi ; le fondateur hors support : mes_promos() et promo_par_defaut() dans ECF,
--                    aucun geste ni aucune case sur B ; le siège de B : gestes du réseau sur B, jamais sur ECF.
--   apercu           (étape 2a, Review Focus 3) le fondateur en aperçu formateur, direction, stagiaire et siège : seulement
--                    son organisme actif (ECF hors support, B en support) ; un en-tête x-promo-id de l'autre organisme ne
--                    l'ouvre jamais (promo par défaut à la place).
--   support          (étape 2a, Review Focus 2) support ouvert sur B : mes_promos(), est_siege(), prédicats et gestes sur B
--                    seulement ; après fermeture et échéance (ligne antidatée) : retour à ECF, et un en-tête x-promo-id de B
--                    rend la promo par défaut d'ECF, sans erreur.
--   siege            (étape 2b) le siège de B, celui d'ECF et le fondateur hors support : creer_centre() crée dans leur
--                    organisme ; comptes_reseau(), lieux et affectations lus, roles_du_personnel() : leur organisme seulement ;
--                    inviter_compte : direction sur un centre de leur organisme, siège dans l'organisme actif du fondateur
--                    (support compris) ; l'habillage réglé par B ne change ni ECF ni la clé globale (miroir de l'organisme 1).
--   titres           (étape 2b) le siège de B ne voit, ne donne, n'ajuste, ne supprime ni ne copie aucun titre réseau d'ECF (refus
--                    « Titre introuvable. », rien d'écrit) ; un titre réseau de B donné crée une affectation siège sur B ; le
--                    fondateur hors support ne retire pas le siège de B et ne touche pas aux titres de B ; personnes_et_titres
--                    et journal_des_droits : rien de l'autre organisme ; apercu_titre() ignore un titre de B hors support.
--   noms             (étape 2b, Review Focus 4) un centre et un titre réseau au nom d'un objet d'ECF créés par B : acceptés ;
--                    les doublons (casse ignorée) dans un même organisme : refusés ; le nom d'un titre fixe reste réservé.
--   retour           les retours défont tout, dans l'ordre inverse (2c, 2b, 2a, 1) : l'empreinte (règles, fonctions, droits)
--                    égale celle d'avant ; tables, colonnes, fonctions et déclencheurs du chantier disparus.
--                    Un retour joué trop tôt (retour 2a avec la 2b en place, retour 1 avec la 2a en place) est refusé par sa garde.
-- GABARIT, à ne pas jouer tel quel : outils/assembler_repetition_roles.mjs y colle les aides (tests/sql/roles-aides.sql,
-- tests/sql/titres-aides.sql, tests/sql/cloisonnement-aides.sql), le libellé du mode, la requête d'empreinte, les migrations et
-- leurs retours :
--   node outils/assembler_repetition_roles.mjs cloisonnement [--etapes 1|1,2a|1,2a,2b|1,2a,2b,2c] <sortie.sql>
--                                       sans --etapes : les étapes dont les fichiers existent (1, puis 2a...) ; VERT attendu
--   node outils/assembler_repetition_roles.mjs cloisonnement-contre-epreuve <sortie.sql>   rien d'injecté : ROUGE attendu
--   node outils/assembler_repetition_roles.mjs cloisonnement-en-ligne <sortie.sql>         rien d'injecté, après application réelle
--   node outils/assembler_repetition_roles.mjs cloisonnement-sabotage <sortie.sql>         les quatre étapes et une règle relâchée
--                                       après la 2c (tests/sql/cloisonnement-sabotage.sql, écrite par la tâche 5) : ROUGE attendu
-- À jouer sur la base de l'état de la production du 27/11 (outils/base_locale/rejouer_suite.sh --production-2711), puis :
--   PGCLIENTENCODING=UTF8 psql -h 127.0.0.1 -p 55447 -U postgres -d postgres -X -q -f <sortie.sql>
-- Le bloc do finit TOUJOURS par une levée : migrations, personnages et lignes d'essai sont annulés, rien ne reste.

-- @@INCLURE tests/sql/roles-aides.sql@@
-- @@INCLURE tests/sql/titres-aides.sql@@
-- @@INCLURE tests/sql/cloisonnement-aides.sql@@

create or replace function pg_temp.empreinte(out regles text, out fonctions text, out droits text)
language plpgsql as $cemp$
begin
  execute
-- @@INJECTER tests/sql/roles-empreinte.sql@@
  into regles, fonctions, droits;
end $cemp$;

-- Les fonctions et les tables que pose l'étape 1 (le groupe retour vérifie qu'elles disparaissent).
create or replace function pg_temp.fonctions_etape_1()
returns text[] language sql as $cfe$
  select array['organisme_de_lieu', 'organisme_de_promo', 'organisme_actif_fondateur', 'fondateur_sur', 'organisme_courant',
               'est_siege_de', 'organisme_redacteur_courant', 'mon_organisme', 'organismes_pour_support', 'ouvrir_acces_support',
               'fermer_acces_support', '_organisme_par_defaut', '_journal_droits_organisme', '_acces_fondateur_journal',
               '_rattachement_fondateur'];
$cfe$;
create or replace function pg_temp.tables_organisme()
returns text[] language sql as $cto$
  select array['lieux', 'affectations', 'titres', 'journal_droits', 'profs', 'ressources', 'qcm_signalements'];
$cto$;

-- Une insertion jouée en service_role (sans jeton) : « OK <lignes> » ou « ERREUR <état> <message> ».
create or replace function pg_temp.clo_service(p_sql text)
returns text language plpgsql as $csv$
declare n bigint; r text;
begin
  perform pg_temp.proprio();
  set local role service_role;
  begin
    execute p_sql;
    get diagnostics n = row_count;
    r := 'OK ' || n;
  exception when others then
    r := 'ERREUR ' || sqlstate || ' ' || sqlerrm;
  end;
  perform pg_temp.proprio();
  return r;
end $csv$;

-- Une insertion jouée en service_role après lui avoir accordé insert et select sur acces_fondateur et sa séquence, dans une
-- sous-transaction toujours annulée (le droit disparaît avec elle) : « OK <lignes> » ou « ERREUR <état> <message> ».
create or replace function pg_temp.clo_service_avec_droit(p_sql text)
returns text language plpgsql as $csd$
declare n bigint; r text;
begin
  perform pg_temp.proprio();
  begin
    grant insert, select on public.acces_fondateur to service_role;
    grant usage, select on sequence public.acces_fondateur_id_seq to service_role;
    set local role service_role;
    execute p_sql;
    get diagnostics n = row_count;
    raise exception using errcode = 'P0001', message = 'OK ' || n;
  exception when others then
    r := case when sqlstate = 'P0001' and sqlerrm like 'OK %' then sqlerrm else 'ERREUR ' || sqlstate || ' ' || sqlerrm end;
  end;
  perform pg_temp.proprio();
  return r;
end $csd$;

-- L'organisme d'une ligne repérée par une condition, relu par le propriétaire (« nul » si nul, « aucune ligne » si rien).
create or replace function pg_temp.org_de(p_table text, p_ou text)
returns text language sql as $cod$
  select coalesce(pg_temp.calcul(format('select coalesce(max(organisme_id)::text, case when count(*) = 0 then ''aucune ligne'' else ''nul'' end) from public.%I where %s', p_table, p_ou)), 'nul');
$cod$;

-- Les rattachements : « fondateurs qui ont exactement un rattachement sur l'organisme 1 / rattachements / fondateurs ».
create or replace function pg_temp.requete_rattachements()
returns text language sql as $crr$
  select $q$select (select count(*) from public.user_profiles up where up.is_founder
        and (select count(*) from public.acces_fondateur af where af.email = lower(up.email) and af.ferme_le is null and af.motif is null and af.organisme_id = 1) = 1)::text
      || '/' || (select count(*) from public.acces_fondateur af where af.ferme_le is null)::text
      || '/' || (select count(*) from public.user_profiles up where up.is_founder)::text$q$;
$crr$;

-- Groupe fondations, partie 1 : ce que la migration pose d'elle-même, avant tout organisme B.
create or replace function pg_temp.groupe_fondations_existant(p_habillage text, p_fondateurs integer)
returns void language plpgsql as $cgfe$
declare t text; v_n integer;
begin
  -- L'existant sur l'organisme 1 : chaque ligne d'avant la migration (repérée par son id) porte l'organisme 1.
  foreach t in array pg_temp.tables_organisme() loop
    v_n := (select count(*) from pg_temp.clo_avant a where a.tbl = t);
    if v_n = 0 then
      perform pg_temp.informer('existant sur l''organisme 1 : ' || t, 'aucune ligne d''avant la migration à juger');
      continue;
    end if;
    perform pg_temp.attendre('fondations', format('existant sur l''organisme 1 : %s (lignes d''avant la migration hors de l''organisme 1 / lignes jugées)', t),
      pg_temp.calcul(format('select count(*) filter (where x.organisme_id is distinct from 1)::text || ''/'' || count(*)::text from public.%I x join pg_temp.clo_avant a on a.tbl = %L and a.id = x.id', t, t)),
      '0/' || v_n);
  end loop;
  -- p_habillage nul : aucun habillage réglé (l'étape 2b rend organismes.habillage facultatif et y reprend la clé globale telle quelle).
  perform pg_temp.attendre('fondations', 'organisme 1 : ECF BOUSCAREN, rédacteur, habillage égal à l''ancien réglage du réseau (nul s''il n''était pas réglé, une fois l''étape 2b en place)',
    pg_temp.calcul($q$select concat_ws('|', id, nom, redacteur::text, habillage) from public.organismes where id = 1$q$),
    '1|ECF BOUSCAREN|true' || coalesce('|' || p_habillage, ''));
  perform pg_temp.verifier('fondations', 'au moins un compte fondateur (jamais un contrôle à vide)', p_fondateurs > 0, 'fondateurs : ' || p_fondateurs);
  perform pg_temp.attendre('fondations', 'un rattachement par fondateur, sur l''organisme 1, sans motif ni fin (fondateurs rattachés / rattachements / fondateurs)',
    pg_temp.calcul(pg_temp.requete_rattachements()), p_fondateurs || '/' || p_fondateurs || '/' || p_fondateurs);
  -- Un compte qui devient fondateur après la migration reçoit son rattachement (à l'insertion comme à la mise à jour), une seule fois.
  insert into public.user_profiles (email, role, is_admin, is_founder) values ('Preuve.Clo.Fondateur.Neuf@exemple.invalid', 'prof', false, true);
  insert into public.user_profiles (email, role, is_admin, is_founder) values ('preuve.clo.fondateur.promu@exemple.invalid', 'prof', false, false);
  update public.user_profiles set is_founder = true where email = 'preuve.clo.fondateur.promu@exemple.invalid';
  update public.user_profiles set is_founder = true where email = 'Preuve.Clo.Fondateur.Neuf@exemple.invalid';
  perform pg_temp.attendre('fondations', 'un compte qui devient fondateur après la migration (insertion ou mise à jour) reçoit un seul rattachement, sur l''organisme 1',
    pg_temp.calcul(pg_temp.requete_rattachements()), (p_fondateurs + 2) || '/' || (p_fondateurs + 2) || '/' || (p_fondateurs + 2));
  perform pg_temp.attendre('fondations', 'la migration n''ouvre aucun support',
    pg_temp.calcul($q$select count(*)::text from public.acces_fondateur where ferme_le is not null or motif is not null$q$), '0');
  -- L'étape 2b étend l'organisme à tous les titres du réseau non fixes (niveau promo ou centre compris) ; les titres fixes et ceux d'un
  -- centre n'en portent jamais.
  if pg_temp.calcul($q$select (to_regprocedure('public.dans_mon_organisme(integer, integer, integer)') is not null)::text$q$) = 'true' then
    perform pg_temp.attendre('fondations', 'les titres fixes et les titres d''un centre restent sans organisme (étape 2b : les titres du réseau de tout niveau en portent un)',
      pg_temp.calcul($q$select count(*)::text from public.titres where (fixe or lieu_id is not null) and organisme_id is not null$q$), '0');
  else
    perform pg_temp.attendre('fondations', 'les titres fixes et les titres de promo ou de centre restent sans organisme',
      pg_temp.calcul($q$select count(*)::text from public.titres where (fixe or niveau <> 'reseau') and organisme_id is not null$q$), '0');
  end if;
  perform pg_temp.attendre('fondations', 'les affectations de formateur et de direction restent sans organisme',
    pg_temp.calcul($q$select count(*)::text from public.affectations where role <> 'siege' and organisme_id is not null$q$), '0');
  perform pg_temp.attendre('fondations', 'unicité du nom de centre par organisme, casse ignorée (index lieux_organisme_nom)',
    pg_temp.calcul($q$select pg_get_indexdef('public.lieux_organisme_nom'::regclass)$q$),
    'CREATE UNIQUE INDEX lieux_organisme_nom ON public.lieux USING btree (organisme_id, lower(nom))');
  perform pg_temp.attendre('fondations', 'lieux.organisme_id obligatoire',
    pg_temp.calcul($q$select attnotnull::text from pg_attribute where attrelid = 'public.lieux'::regclass and attname = 'organisme_id'$q$), 'true');
  -- Fonctions : security definer, chemin de recherche fixé ; droits d'exécution ; tables : aucun droit d'écriture direct.
  perform pg_temp.attendre('fondations', 'les quinze fonctions de l''étape 1 existent, security definer, search_path public, pg_temp',
    pg_temp.calcul(format($q$select count(*) filter (where p.prosecdef and p.proconfig @> array['search_path=public, pg_temp'])::text || '/' || count(*)::text
      from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any (%L::text[])$q$, pg_temp.fonctions_etape_1())), '15/15');
  perform pg_temp.attendre('fondations', 'exécution ouverte à authenticated : les quatre fonctions de l''app et est_siege_de (règle de lecture du journal), rien d''autre',
    pg_temp.calcul(format($q$select string_agg(p.proname, ',' order by p.proname) from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.proname = any (%L::text[]) and has_function_privilege('authenticated', p.oid, 'execute')$q$, pg_temp.fonctions_etape_1())),
    'est_siege_de,fermer_acces_support,mon_organisme,organismes_pour_support,ouvrir_acces_support');
  perform pg_temp.attendre('fondations', 'aucune fonction de l''étape 1 exécutable par anon ni par service_role (anon/service_role)',
    pg_temp.calcul(format($q$select count(*) filter (where has_function_privilege('anon', p.oid, 'execute'))::text || '/'
        || count(*) filter (where has_function_privilege('service_role', p.oid, 'execute'))::text from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.proname = any (%L::text[])$q$, pg_temp.fonctions_etape_1())), '0/0');
  perform pg_temp.attendre('fondations', 'organismes et acces_fondateur : sécurité de ligne active ; aucune écriture pour anon, authenticated ni service_role ; aucun droit sur leurs séquences ; acces_fondateur lisible par authenticated seul ; organismes lisible par aucun (droits par défaut de Supabase simulés)',
    pg_temp.calcul($q$select concat_ws('|',
        (select string_agg(c.relname || '=' || c.relrowsecurity, ',' order by c.relname) from pg_class c where c.oid in ('public.organismes'::regclass, 'public.acces_fondateur'::regclass)),
        (select count(*) from (values ('anon'), ('authenticated'), ('service_role')) r(r) cross join (values ('public.organismes'), ('public.acces_fondateur')) t(t)
          cross join (values ('insert'), ('update'), ('delete'), ('truncate'), ('references'), ('trigger')) d(d) where has_table_privilege(r.r, t.t, d.d)),
        (select count(*) from (values ('anon'), ('authenticated'), ('service_role')) r(r) cross join (values ('public.organismes_id_seq'), ('public.acces_fondateur_id_seq')) t(t)
          cross join (values ('usage'), ('select'), ('update')) d(d) where has_sequence_privilege(r.r, t.t, d.d)),
        has_table_privilege('authenticated', 'public.acces_fondateur', 'select')::text, has_table_privilege('anon', 'public.acces_fondateur', 'select')::text,
        has_table_privilege('service_role', 'public.acces_fondateur', 'select')::text,
        (select count(*) from (values ('anon'), ('authenticated'), ('service_role')) r(r) where has_table_privilege(r.r, 'public.organismes', 'select')))$q$),
    'acces_fondateur=true,organismes=true|0|0|true|false|false|0');
end $cgfe$;

-- Groupe fondations, partie 2 : le vocabulaire et mon_organisme(), une fois l'organisme B posé.
create or replace function pg_temp.groupe_fondations_personnages()
returns void language plpgsql as $cgfp$
declare p record; v_a text := pg_temp.clo('org_a'); v_b text := pg_temp.clo('org_b'); v_attendu text;
begin
  perform pg_temp.verifier('fondations', 'organisme B posé (jamais un contrôle à vide)', v_b ~ '^[0-9]+$' and v_b <> v_a, 'organisme B : ' || coalesce(v_b, 'nul'));
  perform pg_temp.attendre('fondations', 'organisme_de_lieu : centre de la promo 1 dans ECF, centre B dans B',
    pg_temp.clo_lire(null, format('select public.organisme_de_lieu(%s)::text || ''/'' || public.organisme_de_lieu(%s)::text', pg_temp.clo('lieu_a'), coalesce(pg_temp.clo('lieu_b'), 'null'))),
    'OK ' || v_a || '/' || v_b);
  perform pg_temp.attendre('fondations', 'organisme_de_promo : promo 1 dans ECF, promo B dans B, promo inconnue nulle',
    pg_temp.clo_lire(null, format('select public.organisme_de_promo(1)::text || ''/'' || public.organisme_de_promo(%s)::text || ''/'' || coalesce(public.organisme_de_promo(-1)::text, ''nul'')', pg_temp.clo('promo_b'))),
    'OK ' || v_a || '/' || v_b || '/nul');
  for p in select * from pg_temp.clo_perso order by org, nom loop
    v_attendu := pg_temp.clo_org(p.nom);
    perform pg_temp.attendre('fondations', format('organisme_courant() de %s', p.nom),
      pg_temp.clo_lire(p.nom, 'select public.organisme_courant()::text', true), 'OK ' || v_attendu);
    perform pg_temp.attendre('fondations', format('mon_organisme() de %s : son organisme (id, nom, rédacteur)', p.nom),
      pg_temp.clo_lire(p.nom, 'select concat_ws(''|'', id, nom, redacteur::text) from public.mon_organisme()'),
      case p.org when 'A' then 'OK ' || v_a || '|ECF BOUSCAREN|true' else 'OK ' || v_b || '|Organisme B fictif|false' end);
    perform pg_temp.attendre('fondations', format('organisme_redacteur_courant() de %s', p.nom),
      pg_temp.clo_lire(p.nom, 'select public.organisme_redacteur_courant()::text', true), case p.org when 'A' then 'OK true' else 'OK false' end);
    if p.nom = 'fond_a' then
      perform pg_temp.attendre('fondations', 'organismes_pour_support() du fondateur : tous les organismes',
        pg_temp.clo_lire(p.nom, 'select string_agg(id::text || '':'' || nom, '','' order by id) from public.organismes_pour_support()'),
        'OK ' || pg_temp.calcul($q$select string_agg(id::text || ':' || nom, ',' order by id) from public.organismes$q$));
    else
      perform pg_temp.verifier('fondations', format('organismes_pour_support() refusée à %s (42501)', p.nom),
        pg_temp.clo_lire(p.nom, 'select count(*)::text from public.organismes_pour_support()') like 'ERREUR 42501 %',
        pg_temp.clo_lire(p.nom, 'select count(*)::text from public.organismes_pour_support()'));
    end if;
  end loop;
  perform pg_temp.verifier('fondations', 'mon_organisme() et organismes_pour_support() refusées à anon (42501)',
    pg_temp.valeur(null, null, null, 'select count(*)::text from public.mon_organisme()') = 'ERREUR 42501'
      and pg_temp.valeur(null, null, null, 'select count(*)::text from public.organismes_pour_support()') = 'ERREUR 42501',
    pg_temp.valeur(null, null, null, 'select count(*)::text from public.mon_organisme()'));
  -- Le fondateur hors support : organisme actif = rattachement ; fondateur_sur vrai chez lui seulement.
  perform pg_temp.attendre('fondations', 'organisme_actif_fondateur() : le rattachement pour le fondateur, nul pour un autre compte',
    pg_temp.clo_lire('fond_a', 'select public.organisme_actif_fondateur()::text', true) || ' ; ' || pg_temp.clo_lire('siege_a', 'select coalesce(public.organisme_actif_fondateur()::text, ''nul'')', true),
    'OK ' || v_a || ' ; OK nul');
  perform pg_temp.attendre('fondations', 'fondateur_sur : vrai pour le fondateur sur ECF, faux sur B, faux pour le siège d''ECF',
    pg_temp.clo_lire('fond_a', format('select public.fondateur_sur(%s)::text || ''/'' || public.fondateur_sur(%s)::text || ''/'' || public.fondateur_sur(null)::text', v_a, v_b), true)
      || ' ; ' || pg_temp.clo_lire('siege_a', format('select public.fondateur_sur(%s)::text', v_a), true),
    'OK true/false/false ; OK false');
  -- est_siege_de : le siège de son organisme seulement ; le fondateur sur son organisme actif ; ni formateur ni direction.
  for p in select * from (values ('siege_a', 'true/false'), ('siege_b', 'false/true'), ('fond_a', 'true/false'), ('form_a', 'false/false'),
                                 ('dir_a', 'false/false'), ('dir_b', 'false/false'), ('stag_b1', 'false/false')) x(nom, attendu) loop
    perform pg_temp.attendre('fondations', format('est_siege_de(ECF)/est_siege_de(B) pour %s', p.nom),
      pg_temp.clo_lire(p.nom, format('select public.est_siege_de(%s)::text || ''/'' || public.est_siege_de(%s)::text', v_a, v_b)),
      'OK ' || p.attendu);
  end loop;
end $cgfp$;

-- Groupe fondations, partie 3 (à la fin) : aucune ligne sans organisme, celles de B et des essais comprises.
create or replace function pg_temp.groupe_fondations_final()
returns void language plpgsql as $cgff$
declare r record;
begin
  for r in select * from (values
      ('lieux', 'true'), ('affectations', 'role = ''siege'''), ('titres', 'niveau = ''reseau'' and not fixe'),
      ('journal_droits', 'true'), ('profs', 'true'), ('qcm_signalements', 'true')) x(t, ou) loop
    perform pg_temp.attendre('fondations', format('à la fin, aucune ligne sans organisme : %s (%s)', r.t, r.ou),
      pg_temp.calcul(format('select count(*)::text from public.%I where organisme_id is null and %s', r.t, r.ou)), '0');
  end loop;
end $cgff$;

-- Groupe support-journal : ouverture, refus, fermeture, journal immuable, lecture.
create or replace function pg_temp.groupe_support_journal()
returns void language plpgsql as $cgsj$
declare
  v_a text := pg_temp.clo('org_a'); v_b text := pg_temp.clo('org_b');
  v_ouv constant text := 'select (public.ouvrir_acces_support(%s, %s, %s)).organisme_id::text';
  r record; v text; v_s1 text; v_s2 text; v_s3 text; v_total text; c_insertion text;
begin
  perform pg_temp.attendre('support-journal', 'hors support, mon_organisme() du fondateur ne porte aucune échéance',
    pg_temp.clo_lire('fond_a', 'select coalesce(support_jusqua::text, ''aucune'') from public.mon_organisme()'), 'OK aucune');
  -- Refus (22023) : motif court, blanc rembourré ou absent ; durée nulle, négative, absente ou de 3 h ; organisme du rattachement ou inconnu.
  for r in select * from (values
      ('motif de 5 caractères', v_b, '''court''', '''1 hour''::interval'),
      ('motif de 3 caractères entouré de blancs', v_b, '''      abc       ''', '''1 hour''::interval'),
      ('motif de 3 caractères entouré de tabulations et de retours à la ligne', v_b, 'E''\t\t\tabc\n\n\n\n\n\r\n''', '''1 hour''::interval'),
      ('motif de 11 tabulations et retours à la ligne', v_b, 'E''\t\t\t\t\t\n\n\n\n\r\n''', '''1 hour''::interval'),
      ('motif absent', v_b, 'null', '''1 hour''::interval'),
      ('durée de 3 heures', v_b, '''Assistance demandée par la preuve''', '''3 hours''::interval'),
      ('durée de 2 heures et 1 seconde', v_b, '''Assistance demandée par la preuve''', '''2 hours 1 second''::interval'),
      ('durée nulle', v_b, '''Assistance demandée par la preuve''', '''0''::interval'),
      ('durée négative', v_b, '''Assistance demandée par la preuve''', '''-1 hour''::interval'),
      ('durée absente', v_b, '''Assistance demandée par la preuve''', 'null::interval'),
      ('organisme du rattachement', v_a, '''Assistance demandée par la preuve''', '''1 hour''::interval'),
      ('organisme inconnu', '-1', '''Assistance demandée par la preuve''', '''1 hour''::interval'),
      ('organisme absent', 'null', '''Assistance demandée par la preuve''', '''1 hour''::interval')) x(libelle, org, motif, duree) loop
    v := pg_temp.clo_lire('fond_a', format(v_ouv, coalesce(r.org, 'null'), r.motif, r.duree));
    perform pg_temp.verifier('support-journal', 'ouvrir_acces_support refusé (22023) : ' || r.libelle, v like 'ERREUR 22023 %', v);
  end loop;
  -- Refus (42501) : tout autre compte, pour ouvrir comme pour fermer ; anon n'a pas l'exécution.
  for r in select nom from pg_temp.clo_perso where nom <> 'fond_a' order by nom loop
    v := pg_temp.clo_lire(r.nom, format(v_ouv, coalesce(v_b, 'null'), '''Assistance demandée par la preuve''', '''1 hour''::interval'))
      || ' ; ' || pg_temp.clo_lire(r.nom, 'select ''fait'' from public.fermer_acces_support() f');
    perform pg_temp.verifier('support-journal', format('ouvrir et fermer un support refusés à %s (42501)', r.nom),
      v like 'ERREUR 42501 % ; ERREUR 42501 %', v);
  end loop;
  perform pg_temp.attendre('support-journal', 'ouvrir_acces_support et fermer_acces_support refusées à anon (42501)',
    pg_temp.valeur(null, null, null, format(v_ouv, coalesce(v_b, 'null'), '''Assistance demandée par la preuve''', '''1 hour''::interval'))
      || ' ; ' || pg_temp.valeur(null, null, null, 'select ''fait'' from public.fermer_acces_support() f'), 'ERREUR 42501 ; ERREUR 42501');
  perform pg_temp.attendre('support-journal', 'aucun refus n''a écrit de ligne de support',
    pg_temp.calcul($q$select count(*)::text from public.acces_fondateur where motif is not null$q$), '0');

  -- Ouverture : la ligne rendue (organisme, motif sans ses blancs, échéance, ouverture, auteur, adresse).
  perform pg_temp.attendre('support-journal', 'support ouvert sur B pour 1 heure : la ligne rendue (organisme, motif nettoyé, échéance, ouverture, auteur, adresse)',
    pg_temp.clo_lire('fond_a', format($q$select concat_ws('|', r.organisme_id, r.motif, (r.ferme_le = now() + interval '1 hour')::text, (r.ouvert_le = now())::text,
        (r.ouvert_par = lower(auth.jwt() ->> 'email'))::text, (r.email = lower(auth.jwt() ->> 'email'))::text)
      from public.ouvrir_acces_support(%s, '   Assistance demandée par la preuve du cloisonnement   ', '1 hour') r$q$, coalesce(v_b, 'null'))),
    'OK ' || v_b || '|Assistance demandée par la preuve du cloisonnement|true|true|true|true');
  v_s1 := pg_temp.calcul($q$select max(id)::text from public.acces_fondateur where motif is not null$q$);
  perform pg_temp.attendre('support-journal', 'en support : organisme actif, organisme courant et mon_organisme() du fondateur sur B, échéance dans 1 heure',
    pg_temp.clo_lire('fond_a', 'select public.organisme_actif_fondateur()::text || ''/'' || public.organisme_courant()::text', true)
      || ' ; ' || pg_temp.clo_lire('fond_a', 'select concat_ws(''|'', id, (support_jusqua = now() + interval ''1 hour'')::text) from public.mon_organisme()'),
    'OK ' || v_b || '/' || v_b || ' ; OK ' || v_b || '|true');
  perform pg_temp.attendre('support-journal', 'en support : fondateur_sur(B) vrai, fondateur_sur(ECF) faux (un seul organisme actif)',
    pg_temp.clo_lire('fond_a', format('select public.fondateur_sur(%s)::text || ''/'' || public.fondateur_sur(%s)::text', v_b, v_a), true),
    'OK true/false');
  -- Un second support (durée par défaut : 2 heures) ferme le premier.
  perform pg_temp.attendre('support-journal', 'second support (durée par défaut) : ouvert pour 2 heures',
    pg_temp.clo_lire('fond_a', format($q$select (r.ferme_le = now() + interval '2 hours')::text from public.ouvrir_acces_support(%s, 'Seconde assistance de la preuve') r$q$, coalesce(v_b, 'null'))),
    'OK true');
  v_s2 := pg_temp.calcul($q$select max(id)::text from public.acces_fondateur where motif is not null$q$);
  perform pg_temp.attendre('support-journal', 'le second support ferme le premier : un seul support ouvert, le premier fermé maintenant',
    pg_temp.calcul(format($q$select (select count(*) from public.acces_fondateur where motif is not null and ferme_le > now())::text
      || '/' || coalesce((select (ferme_le = now())::text from public.acces_fondateur where id = %s), 'nul')$q$, coalesce(v_s1, 'null'))),
    '1/true');
  -- Écritures directes du fondateur : aucun droit (ni insert, ni update, ni delete).
  for r in select * from (values
      ('insertion', format('insert into public.acces_fondateur (email, organisme_id, ferme_le, motif) values (lower(auth.jwt() ->> ''email''), %s, now() + interval ''1 hour'', ''Ligne écrite à la main'')', coalesce(v_b, 'null'))),
      ('modification', 'update public.acces_fondateur set motif = ''Motif réécrit par la preuve'''),
      ('suppression', 'delete from public.acces_fondateur')) x(libelle, req) loop
    v := pg_temp.clo_ecrire('fond_a', r.req);
    perform pg_temp.verifier('support-journal', 'le fondateur n''écrit pas le journal à la main (42501) : ' || r.libelle, v like 'ERREUR 42501 %', v);
  end loop;
  -- Le propriétaire lui-même : le déclencheur refuse modification, suppression, TRUNCATE et ferme_le vers le futur.
  for r in select * from (values
      ('modification du motif d''un support', format('update public.acces_fondateur set motif = ''Motif réécrit par la preuve'' where id = %s', coalesce(v_s2, 'null'))),
      ('modification de l''organisme d''un support', format('update public.acces_fondateur set organisme_id = %s where id = %s', v_a, coalesce(v_s2, 'null'))),
      ('suppression d''un support', format('delete from public.acces_fondateur where id = %s', coalesce(v_s1, 'null'))),
      ('suppression du rattachement', 'delete from public.acces_fondateur where ferme_le is null'),
      ('TRUNCATE du journal', 'truncate public.acces_fondateur'),
      ('ferme_le d''un support ouvert repoussé d''une minute', format('update public.acces_fondateur set ferme_le = ferme_le + interval ''1 minute'' where id = %s', coalesce(v_s2, 'null'))),
      ('ferme_le d''un support ouvert avancé sans aller à maintenant', format('update public.acces_fondateur set ferme_le = now() + interval ''1 hour'' where id = %s', coalesce(v_s2, 'null'))),
      ('ferme_le d''un support fermé remis dans le futur', format('update public.acces_fondateur set ferme_le = now() + interval ''1 hour'' where id = %s', coalesce(v_s1, 'null'))),
      ('fermeture du rattachement', 'update public.acces_fondateur set ferme_le = now() where ferme_le is null')) x(libelle, req) loop
    v := pg_temp.clo_ecrire(null, r.req);
    perform pg_temp.verifier('support-journal', 'refusé même au propriétaire (42501) : ' || r.libelle, v like 'ERREUR 42501 %', v);
  end loop;
  -- Insertion directe dans le journal : refusée à service_role (aucun droit : les droits par défaut de Supabase, simulés, sont
  -- retirés par la migration) ; refusée par le déclencheur au propriétaire et à service_role même muni d'un droit d'insertion
  -- (accordé ici le temps de l'essai, comme le ferait une erreur future).
  c_insertion := format($q$insert into public.acces_fondateur (email, organisme_id, ouvert_le, ferme_le, motif, ouvert_par)
    values (%L, %s, now() - interval '30 minutes', now() + interval '1 hour', 'Support forgé hors de la fonction', 'preuve')$q$,
    (select email from pg_temp.clo_perso where nom = 'fond_a'), coalesce(v_b, 'null'));
  v := pg_temp.clo_service(c_insertion);
  perform pg_temp.verifier('support-journal', 'service_role n''insère pas dans le journal (42501, aucun droit)', v like 'ERREUR 42501 %', v);
  v := pg_temp.clo_service($q$insert into public.organismes (nom, redacteur, habillage) values ('Organisme forgé', true, 'ecf')$q$)
    || ' ; ' || pg_temp.clo_service($q$update public.organismes set redacteur = true$q$);
  perform pg_temp.verifier('support-journal', 'service_role n''écrit pas les organismes (insertion, modification : 42501)', v like 'ERREUR 42501 % ; ERREUR 42501 %', v);
  perform pg_temp.attendre('support-journal', 'le propriétaire n''insère pas dans le journal hors de ouvrir_acces_support (déclencheur, 42501)',
    pg_temp.clo_ecrire(null, c_insertion), 'ERREUR 42501 support: Le journal du fondateur ne s''écrit que par ouvrir_acces_support().');
  perform pg_temp.attendre('support-journal', 'service_role muni d''un droit d''insertion accordé par erreur : refusé par le déclencheur (42501)',
    pg_temp.clo_service_avec_droit(c_insertion), 'ERREUR 42501 support: Le journal du fondateur ne s''écrit que par ouvrir_acces_support().');
  perform pg_temp.attendre('support-journal', 'aucune ligne forgée dans le journal ni aucun organisme forgé',
    pg_temp.calcul($q$select (select count(*) from public.acces_fondateur where motif = 'Support forgé hors de la fonction' or ouvert_par = 'preuve')::text
      || '/' || (select count(*) from public.organismes where nom = 'Organisme forgé' or (redacteur and id <> 1))::text$q$), '0/0');
  -- La contrainte du motif voit aussi les tabulations et retours à la ligne (marqueur posé à la main, comme le fait la fonction).
  v := pg_temp.clo_ecrire(null, format($q$with m as (select set_config('cloisonnement.journal_fondateur', 'oui', true) as x)
      insert into public.acces_fondateur (email, organisme_id, ferme_le, motif, ouvert_par)
      select %L, %s, now() + interval '1 hour', E'\t\t\t\t\t\n\n\n\n\r\n', 'preuve' from m$q$,
      (select email from pg_temp.clo_perso where nom = 'fond_a'), coalesce(v_b, 'null')));
  perform set_config('cloisonnement.journal_fondateur', '', true);
  perform pg_temp.verifier('support-journal', 'contrainte du motif : 11 tabulations et retours à la ligne refusés (23514, acces_fondateur_motif)',
    v like 'ERREUR 23514 %acces_fondateur_motif%', v);
  -- Fermeture anticipée : acceptée (ferme_le avancé à maintenant), puis le fondateur revient à ECF.
  perform pg_temp.attendre('support-journal', 'fermeture anticipée d''un support par le propriétaire (ferme_le avancé à maintenant) : acceptée',
    pg_temp.clo_ecrire(null, format('update public.acces_fondateur set ferme_le = now() where id = %s', coalesce(v_s2, 'null'))), 'OK 1');
  perform pg_temp.attendre('support-journal', 'support fermé : le fondateur revient à ECF',
    pg_temp.clo_lire('fond_a', 'select public.organisme_actif_fondateur()::text', true), 'OK ' || v_a);
  perform pg_temp.attendre('support-journal', 'troisième support (30 minutes) puis fermer_acces_support() par le fondateur : accepté',
    pg_temp.clo_lire('fond_a', format($q$select r.organisme_id::text from public.ouvrir_acces_support(%s, 'Troisième assistance de la preuve', '30 minutes') r$q$, coalesce(v_b, 'null')))
      || ' ; ' || pg_temp.clo_lire('fond_a', 'select ''fait'' from public.fermer_acces_support() f'),
    'OK ' || v_b || ' ; OK fait');
  v_s3 := pg_temp.calcul($q$select max(id)::text from public.acces_fondateur where motif is not null$q$);
  perform pg_temp.attendre('support-journal', 'après fermer_acces_support() : aucun support ouvert, organisme actif et mon_organisme() sur ECF, sans échéance',
    pg_temp.calcul($q$select count(*)::text from public.acces_fondateur where motif is not null and ferme_le > now()$q$)
      || ' ; ' || pg_temp.clo_lire('fond_a', 'select public.organisme_actif_fondateur()::text', true)
      || ' ; ' || pg_temp.clo_lire('fond_a', 'select concat_ws(''|'', id, coalesce(support_jusqua::text, ''aucune'')) from public.mon_organisme()'),
    '0 ; OK ' || v_a || ' ; OK ' || v_a || '|aucune');
  perform pg_temp.attendre('support-journal', 'le journal garde chaque ligne : le rattachement et trois supports sur B, fermés maintenant, motifs intacts',
    pg_temp.calcul(format($q$select string_agg(concat_ws('|', organisme_id, coalesce(motif, 'rattachement'), coalesce((ferme_le = now())::text, 'sans fin')), ' ; ' order by id)
      from public.acces_fondateur where email = %L$q$, (select email from pg_temp.clo_perso where nom = 'fond_a'))),
    format('%s|rattachement|sans fin ; %s|Assistance demandée par la preuve du cloisonnement|true ; %s|Seconde assistance de la preuve|true ; %s|Troisième assistance de la preuve|true',
      v_a, v_b, v_b, v_b));
  -- Lecture du journal : le fondateur tout ; le siège de l'organisme de la ligne, ses lignes seulement ; les autres rien.
  v_total := pg_temp.calcul($q$select count(*)::text from public.acces_fondateur$q$);
  perform pg_temp.attendre('support-journal', 'lecture du journal par le fondateur : toutes les lignes',
    pg_temp.clo_lire('fond_a', 'select count(*)::text from public.acces_fondateur'), 'OK ' || v_total);
  perform pg_temp.attendre('support-journal', 'lecture du journal par le siège de B : les trois supports sur B, aucune ligne d''ECF',
    pg_temp.clo_lire('siege_b', format('select count(*) filter (where organisme_id = %s)::text || ''/'' || count(*) filter (where organisme_id <> %s)::text from public.acces_fondateur', v_b, v_b)),
    'OK 3/0');
  perform pg_temp.attendre('support-journal', 'lecture du journal par le siège d''ECF : les rattachements d''ECF, aucune ligne de B',
    pg_temp.clo_lire('siege_a', format('select count(*) filter (where organisme_id = %s)::text || ''/'' || count(*) filter (where organisme_id <> %s)::text from public.acces_fondateur', v_a, v_a)),
    'OK ' || pg_temp.calcul(format('select count(*)::text from public.acces_fondateur where organisme_id = %s', v_a)) || '/0');
  for r in select nom from pg_temp.clo_perso where nom not in ('fond_a', 'siege_a', 'siege_b') order by nom loop
    perform pg_temp.attendre('support-journal', format('lecture du journal par %s : aucune ligne', r.nom),
      pg_temp.clo_lire(r.nom, 'select count(*)::text from public.acces_fondateur'), 'OK 0');
  end loop;
end $cgsj$;

-- Groupe remplissage, partie 1 : un seul organisme (B pas encore posé) ; le propriétaire et service_role, sans jeton, prennent celui-là.
create or replace function pg_temp.groupe_remplissage_seul()
returns void language plpgsql as $cgrs$
begin
  -- Sauté seulement quand la base compte déjà plusieurs organismes (mode en ligne, plus tard) ; sans la table (contre-épreuve), joué et rouge.
  if pg_temp.calcul($q$select (count(*) > 1)::text from public.organismes$q$) = 'true' then
    perform pg_temp.informer('remplissage avec un seul organisme', 'non jugeable : la base compte déjà plusieurs organismes');
    return;
  end if;
  perform pg_temp.attendre('remplissage', 'un seul organisme : le propriétaire sans jeton crée un centre sans organisme_id, il prend l''organisme 1',
    pg_temp.clo_ecrire(null, $q$insert into public.lieux (nom) values ('Preuve clo centre seul')$q$) || ' ; ' || pg_temp.org_de('lieux', $q$nom = 'Preuve clo centre seul'$q$),
    'OK 1 ; 1');
  perform pg_temp.attendre('remplissage', 'un seul organisme : un compte connecté sans promo ni affectation signale une question sans organisme_id, accepté comme avant, organisme 1',
    pg_temp.ecrire('preuve.clo.sans.role@exemple.invalid', null, null,
      $q$insert into public.qcm_signalements (question_id, email, motif, commentaire) values ((select min(id) from public.qcm_questions), 'preuve.clo.sans.role@exemple.invalid', 'autre', 'Preuve clo sans role')$q$,
      $q$select organisme_id::text from public.qcm_signalements where commentaire = 'Preuve clo sans role'$q$),
    'OK 1 1');
  perform pg_temp.attendre('remplissage', 'un seul organisme : service_role sans jeton crée une fiche profs sans organisme_id, elle prend l''organisme 1',
    pg_temp.clo_service($q$insert into public.profs (nom) values ('Preuve clo prof seul')$q$) || ' ; ' || pg_temp.org_de('profs', $q$nom = 'Preuve clo prof seul'$q$),
    'OK 1 ; 1');
end $cgrs$;

-- Groupe remplissage, partie 2 : B posé ; chaque ligne prend l'organisme de son auteur ; sans contexte, refus.
create or replace function pg_temp.groupe_remplissage()
returns void language plpgsql as $cgr$
declare
  v_a text := pg_temp.clo('org_a'); v_b text := pg_temp.clo('org_b');
  v_q text := pg_temp.calcul($q$select min(id)::text from public.qcm_questions$q$);
  r record; v text; v_fiche text; v_t text;
  c_refus constant text := 'ERREUR 22023 Organisme introuvable pour cette ligne.';
begin
  -- Centre : en propriétaire avec le jeton du siège (aucun droit d'insertion directe pour authenticated), puis par creer_centre().
  for r in select * from (values ('siege_a', 'A'), ('siege_b', 'B')) x(nom, o) loop
    perform pg_temp.attendre('remplissage', format('lieux, insertion directe (propriétaire, jeton de %s) : la ligne prend l''organisme du siège', r.nom),
      pg_temp.clo_ecrire(r.nom, format('insert into public.lieux (nom) values (%L)', 'Preuve clo centre ' || r.o), true)
        || ' ; ' || pg_temp.org_de('lieux', format('nom = %L', 'Preuve clo centre ' || r.o)),
      'OK 1 ; ' || pg_temp.clo_org(r.nom));
    v := pg_temp.clo_lire(r.nom, format('select public.creer_centre(%L)::text', 'Preuve clo creer ' || r.o));
    perform pg_temp.attendre('remplissage', format('lieux, creer_centre() joué par %s : le centre prend l''organisme du siège', r.nom),
      left(v, 3) || pg_temp.org_de('lieux', format('nom = %L', 'Preuve clo creer ' || r.o)), 'OK ' || pg_temp.clo_org(r.nom));
  end loop;
  -- Fiche profs et carte Ressources : jouées par le formateur (jeton et en-tête de sa promo, comme l'app).
  for r in select * from (values ('form_a', 'A'), ('form_b', 'B')) x(nom, o) loop
    perform pg_temp.attendre('remplissage', format('profs, insertion par %s sans organisme_id : la fiche prend l''organisme de sa promo', r.nom),
      pg_temp.clo_ecrire(r.nom, format('insert into public.profs (nom) values (%L)', 'Preuve clo prof ' || r.o))
        || ' ; ' || pg_temp.org_de('profs', format('nom = %L', 'Preuve clo prof ' || r.o)),
      'OK 1 ; ' || pg_temp.clo_org(r.nom));
    perform pg_temp.attendre('remplissage', format('ressources, insertion par %s sans organisme_id : la carte prend l''organisme de sa promo', r.nom),
      pg_temp.clo_ecrire(r.nom, format('insert into public.ressources (titre, url, categorie) values (%L, ''https://exemple.invalid/r'', ''docs'')', 'Preuve clo carte ' || r.o))
        || ' ; ' || pg_temp.org_de('ressources', format('titre = %L', 'Preuve clo carte ' || r.o)),
      'OK 1 ; ' || pg_temp.clo_org(r.nom));
  end loop;
  -- Signalement de QCM : joué par le stagiaire (jeton et en-tête de sa promo).
  for r in select * from (values ('stag_a', 'A'), ('stag_b1', 'B')) x(nom, o) loop
    v_fiche := pg_temp.calcul(format('select stagiaire_id::text from public.user_profiles where email = %L', (select email from pg_temp.clo_perso where nom = r.nom)));
    perform pg_temp.attendre('remplissage', format('qcm_signalements, insertion par %s sans organisme_id : le signalement prend l''organisme de sa promo', r.nom),
      pg_temp.clo_ecrire(r.nom, format('insert into public.qcm_signalements (question_id, email, stagiaire_id, motif, commentaire) values (%s, lower(auth.jwt() ->> ''email''), %s, ''autre'', %L)',
          coalesce(v_q, 'null'), coalesce(v_fiche, 'null'), 'Preuve clo remplissage ' || r.o))
        || ' ; ' || pg_temp.org_de('qcm_signalements', format('commentaire = %L', 'Preuve clo remplissage ' || r.o)),
      'OK 1 ; ' || pg_temp.clo_org(r.nom));
  end loop;
  -- Siège et titre réseau : en propriétaire avec le jeton du siège de B (gestes de l'app : inviter_compte, creer_titre).
  insert into public.user_profiles (email, role, is_admin) values
    ('preuve.clo.siege.b2@exemple.invalid', 'prof', false), ('preuve.clo.siege.b3@exemple.invalid', 'prof', false);
  perform pg_temp.attendre('remplissage', 'affectations, siège nommé sans organisme_id avec le jeton du siège de B : l''affectation prend B',
    pg_temp.clo_ecrire('siege_b', $q$insert into public.affectations (email, role) values ('preuve.clo.siege.b2@exemple.invalid', 'siege')$q$, true)
      || ' ; ' || pg_temp.org_de('affectations', $q$email = 'preuve.clo.siege.b2@exemple.invalid'$q$),
    'OK 1 ; ' || v_b);
  perform pg_temp.attendre('remplissage', 'affectations, siège nommé avec le titre réseau de B (jeton du siège d''ECF) : l''affectation prend l''organisme du titre',
    pg_temp.clo_ecrire('siege_a', format('insert into public.affectations (email, role, titre_id) values (''preuve.clo.siege.b3@exemple.invalid'', ''siege'', %s)', coalesce(pg_temp.clo('titre_b'), 'null')), true)
      || ' ; ' || pg_temp.org_de('affectations', $q$email = 'preuve.clo.siege.b3@exemple.invalid'$q$),
    'OK 1 ; ' || v_b);
  perform pg_temp.attendre('remplissage', 'titres, titre réseau créé sans organisme_id avec le jeton du siège de B : il prend B, et sa ligne de journal aussi',
    pg_temp.clo_ecrire('siege_b', $q$insert into public.titres (nom, niveau, cases, cree_par) values ('Preuve clo titre B remplissage', 'reseau', '{}', 'preuve')$q$, true)
      || ' ; ' || pg_temp.org_de('titres', $q$nom = 'Preuve clo titre B remplissage'$q$)
      || ' ; ' || pg_temp.org_de('journal_droits', $q$titre_nom = 'Preuve clo titre B remplissage' and action = 'cree'$q$),
    'OK 1 ; ' || v_b || ' ; ' || v_b);
  perform pg_temp.attendre('remplissage', 'titres, titre de centre créé avec le jeton du siège de B : sans organisme (seuls les titres réseau en portent un)',
    pg_temp.clo_ecrire('siege_b', format($q$insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values ('Preuve clo titre centre B', 'centre', %s, '{}', 'preuve')$q$, coalesce(pg_temp.clo('lieu_b'), 'null')), true)
      || ' ; ' || pg_temp.org_de('titres', $q$nom = 'Preuve clo titre centre B'$q$),
    'OK 1 ; nul');
  -- Deux organismes : sans contexte, ni le propriétaire ni service_role ne devinent ; un compte sans promo ni affectation non plus.
  for r in select * from (values
      ('lieux', $q$insert into public.lieux (nom) values ('Preuve clo centre orphelin')$q$),
      ('profs', $q$insert into public.profs (nom) values ('Preuve clo prof orphelin')$q$),
      ('ressources', $q$insert into public.ressources (titre, url, categorie) values ('Preuve clo carte orpheline', 'https://exemple.invalid/o', 'docs')$q$),
      ('qcm_signalements', format($q$insert into public.qcm_signalements (question_id, email, motif) values (%s, 'preuve.clo.orphelin@exemple.invalid', 'autre')$q$, coalesce(v_q, 'null'))),
      ('affectations (siège)', $q$insert into public.affectations (email, role) values ('preuve.clo.siege.b2@exemple.invalid', 'siege')$q$),
      ('titres (réseau)', $q$insert into public.titres (nom, niveau, cases, cree_par) values ('Preuve clo titre orphelin', 'reseau', '{}', 'preuve')$q$)) x(t, req) loop
    perform pg_temp.attendre('remplissage', format('deux organismes, propriétaire sans jeton : %s refusé, « Organisme introuvable pour cette ligne. »', r.t),
      pg_temp.clo_ecrire(null, r.req), c_refus);
  end loop;
  perform pg_temp.attendre('remplissage', 'deux organismes, service_role sans jeton : fiche profs refusée, « Organisme introuvable pour cette ligne. »',
    pg_temp.clo_service($q$insert into public.profs (nom) values ('Preuve clo prof orphelin service')$q$), c_refus);
  perform pg_temp.attendre('remplissage', 'deux organismes, compte connecté sans promo ni affectation : signalement refusé, « Organisme introuvable pour cette ligne. »',
    pg_temp.ecrire('preuve.clo.orphelin@exemple.invalid', null, null,
      format($q$insert into public.qcm_signalements (question_id, email, motif) values (%s, 'preuve.clo.orphelin@exemple.invalid', 'autre')$q$, coalesce(v_q, 'null'))),
    'REFUS 22023');
end $cgr$;

-- Une lecture jouée par le propriétaire avec le contexte d'un personnage, sous un en-tête x-promo-id et un aperçu choisis (nuls :
-- absents) : « OK <valeur> » ou « ERREUR <état> <message> ». Sert aux fonctions internes et aux en-têtes d'une autre promo.
create or replace function pg_temp.clo_jouer(p_nom text, p_entete text, p_apercu text, p_sql text)
returns text language plpgsql as $cjo$
declare v text; r text;
begin
  perform pg_temp.contexte((select p.email from pg_temp.clo_perso p where p.nom = p_nom), p_entete, p_apercu);
  begin
    execute p_sql into v;
    r := rtrim('OK ' || coalesce(v, 'nul'));
  exception when others then
    r := 'ERREUR ' || sqlstate || ' ' || sqlerrm;
  end;
  perform pg_temp.proprio();
  return r;
end $cjo$;

-- Un identifiant posé, ou le littéral null (objet non posé : la requête rend alors faux ou nul, jamais une erreur de syntaxe).
create or replace function pg_temp.clo_n(p_cle text)
returns text language sql as $cn$
  select case when pg_temp.clo(p_cle) ~ '^[0-9]+$' then pg_temp.clo(p_cle) else 'null' end;
$cn$;

-- Groupe equivalence-ecf : la requête du noyau, « nom=valeur » séparés par des virgules. Promos : la promo affichée, 1, 2, 7, nulle,
-- inconnue ; centres : le centre affiché, ceux des promos 1, 2 et 7, nul, inconnu ; pages et gestes de _pages_du_niveau et des
-- gestes (liste écrite en dur, celle de titres-preuve.sql).
create or replace function pg_temp.requete_noyau()
returns text language plpgsql as $crn$
declare
  r text[] := '{}'; x text; g text;
  v_promos constant text[] := array['promo_courante()', '1', '2', '7', 'null::integer', '-1'];
  v_lieux constant text[] := array['lieu_courant()', 'lieu_de_promo(1)', 'lieu_de_promo(2)', 'lieu_de_promo(7)', 'null::integer', '-1'];
  v_pages_promo constant text[] := array['planning', 'emargement', 'stagiaires', 'notes', 'cours', 'ccp2', 'indicateurs', 'reglages'];
  v_pages_centre constant text[] := array['promos', 'stagiaires', 'emargement', 'notes', 'equipe', 'reglages'];
  v_pages_reseau constant text[] := array['cours', 'directions', 'reglages'];
  v_gestes_promo constant text[] := array['planning.lire', 'planning.modifier', 'emargement.lire', 'emargement.tenir', 'stagiaires.lire',
    'stagiaires.gerer', 'stagiaires.supprimer', 'anonymiser', 'benevoles.lire', 'benevoles.gerer', 'benevoles.purger', 'notes.lire',
    'notes.saisir', 'contenus.lire_internes', 'contenus.rediger', 'referentiel.modifier', 'contenus.traiter', 'reglages.modifier',
    'modules.modifier', 'promo.renommer', 'fiches_internes.ecrire'];
  v_gestes_centre constant text[] := array['promos.gerer', 'reglages.modifier', 'donnees.purger', 'formateurs.nommer', 'promos.lire', 'equipe.lire'];
  v_gestes_reseau constant text[] := array['centres.creer', 'directions.nommer', 'directions.lire', 'reglages.modifier'];
begin
  foreach x in array v_promos loop
    r := r || format('%L || coalesce(public.est_formateur(%s)::text, ''nul'')', 'est_formateur(' || x || ')=', x)
           || format('%L || coalesce(public.peut_acceder_promo(%s)::text, ''nul'')', 'peut_acceder_promo(' || x || ')=', x)
           || format('%L || coalesce(public.formateur_fixe(%s)::text, ''nul'')', 'formateur_fixe(' || x || ')=', x)
           || format('%L || coalesce(public.membre_stagiaire(%s)::text, ''nul'')', 'membre_stagiaire(' || x || ')=', x);
    foreach g in array v_pages_promo loop
      r := r || format('%L || coalesce(public.case_promo(%s, %L)::text, ''nul'')', 'case_promo(' || x || ',' || g || ')=', x, g);
    end loop;
    foreach g in array v_gestes_promo loop
      r := r || format('%L || coalesce(public.geste_promo(%s, %L)::text, ''nul'')', 'geste_promo(' || x || ',' || g || ')=', x, g);
    end loop;
  end loop;
  foreach x in array v_lieux loop
    r := r || format('%L || coalesce(public.est_direction(%s)::text, ''nul'')', 'est_direction(' || x || ')=', x)
           || format('%L || coalesce(public.direction_fixe(%s)::text, ''nul'')', 'direction_fixe(' || x || ')=', x);
    foreach g in array v_pages_centre loop
      r := r || format('%L || coalesce(public.case_centre(%s, %L)::text, ''nul'')', 'case_centre(' || x || ',' || g || ')=', x, g);
    end loop;
    foreach g in array v_gestes_centre loop
      r := r || format('%L || coalesce(public.geste_centre(%s, %L)::text, ''nul'')', 'geste_centre(' || x || ',' || g || ')=', x, g);
    end loop;
  end loop;
  r := r || array['''est_siege()='' || coalesce(public.est_siege()::text, ''nul'')',
                  '''siege_fixe()='' || coalesce(public.siege_fixe()::text, ''nul'')'];
  foreach g in array v_pages_reseau loop
    r := r || format('%L || coalesce(public.case_reseau(%L)::text, ''nul'')', 'case_reseau(' || g || ')=', g);
  end loop;
  foreach g in array v_gestes_reseau loop
    r := r || format('%L || coalesce(public.geste_reseau(%L)::text, ''nul'')', 'geste_reseau(' || g || ')=', g);
  end loop;
  r := r || array['''promo_courante()='' || coalesce(public.promo_courante()::text, ''nul'')',
                  '''promo_par_defaut()='' || coalesce(public.promo_par_defaut()::text, ''nul'')',
                  '''lieu_courant()='' || coalesce(public.lieu_courant()::text, ''nul'')',
                  '''formateur_courant()='' || coalesce(public.formateur_courant()::text, ''nul'')',
                  '''direction_courante()='' || coalesce(public.direction_courante()::text, ''nul'')',
                  '''est_fondateur()='' || coalesce(public.est_fondateur()::text, ''nul'')',
                  '''is_admin()='' || coalesce(public.is_admin()::text, ''nul'')',
                  '''apercu_role()='' || coalesce(public.apercu_role(), ''nul'')',
                  '''mes_promos()='' || coalesce((select string_agg(m.id || '':'' || m.par_defaut || '':'' || (m.stagiaire_id is not null)::text || '':'' || array_to_string(m.roles, ''+''), '';'' order by m.id) from public.mes_promos() m), ''aucune'')'];
  return 'select ' || array_to_string(r, ' || '','' || ');
end $crn$;

-- La photo du noyau : les personnages de titres-aides (poser_perso), le fondateur réel et l'anonyme, chacun dans 14 contextes (sans
-- en-tête, en-tête des promos 1, 2, 7 et d'une promo inconnue ; aperçu stagiaire, formateur, direction, siège sous l'en-tête 1 puis
-- 2), joués par le propriétaire avec leur contexte. Les personnages sont posés dans une sous-transaction toujours annulée : la base
-- ne garde rien, la photo (une ligne par personnage et contexte) survit dans la variable.
create or replace function pg_temp.photo_noyau()
returns text language plpgsql as $cph$
declare
  v_req text; v_res text := ''; p record; ctx record; v text;
  v_fondateur text := (select lower(up.email) from public.user_profiles up where up.is_founder
                        order by lower(up.email) like '%@exemple.invalid', lower(up.email) limit 1);
begin
  begin
    v_req := pg_temp.requete_noyau();
    perform pg_temp.poser_perso();
    for p in select x.nom, x.email from (
               select ordre, nom, email from pg_temp.perso
               union all select 100, 'fondateur réel', v_fondateur
               union all select 101, 'anonyme', null) x order by x.ordre loop
      for ctx in
        select h.e, null::text as a from (values (null::text), ('1'), ('2'), ('7'), ('999999')) h(e)
        union all
        select h.e, a.a from (values ('1'), ('2')) h(e) cross join (values ('stagiaire'), ('formateur'), ('direction'), ('siege')) a(a)
      loop
        v := pg_temp.valeur_proprio(p.email, ctx.e, ctx.a, v_req);
        v_res := v_res || format('%s/%s/%s#%s', p.nom, coalesce(ctx.e, 'sans'), coalesce(ctx.a, 'aucun'), coalesce(v, 'nul')) || E'\n';
      end loop;
    end loop;
    raise exception using errcode = 'P0001', message = 'photo du noyau prise';
  exception when others then
    if sqlstate <> 'P0001' or sqlerrm <> 'photo du noyau prise' then
      v_res := 'ERREUR ' || sqlstate || ' ' || sqlerrm;
    end if;
  end;
  perform pg_temp.proprio();
  return v_res;
end $cph$;

-- Groupe equivalence-ecf : la photo prise après l'étape 1 (avant 2a) contre celle prise après toutes les migrations, ECF seul.
create or replace function pg_temp.groupe_equivalence_ecf(p_avant text, p_apres text, p_etat_2a text)
returns void language plpgsql as $cge$
declare
  la text[]; lb text[]; i integer; ta text[]; tb text[]; j integer;
  v_ncmp integer := 0; v_necart integer := 0; v_ecarts text := '';
begin
  perform pg_temp.informer('equivalence-ecf', format('étape 2a %s ; photos de %s et %s lignes', coalesce(p_etat_2a, 'nulle'),
    coalesce(array_length(string_to_array(rtrim(p_avant, E'\n'), E'\n'), 1), 0),
    coalesce(array_length(string_to_array(rtrim(p_apres, E'\n'), E'\n'), 1), 0)));
  perform pg_temp.verifier('equivalence-ecf', 'les deux photos se prennent sans erreur',
    p_avant is not null and p_apres is not null and p_avant not like 'ERREUR %' and p_apres not like 'ERREUR %'
      and position('#ERREUR' in p_avant) = 0 and position('#ERREUR' in p_apres) = 0,
    left(coalesce(substring(p_avant from '[^\n]*#ERREUR[^\n]*'), substring(p_apres from '[^\n]*#ERREUR[^\n]*'),
                  case when p_avant like 'ERREUR %' then p_avant when p_apres like 'ERREUR %' then p_apres end, ''), 300));
  la := string_to_array(rtrim(coalesce(p_avant, ''), E'\n'), E'\n');
  lb := string_to_array(rtrim(coalesce(p_apres, ''), E'\n'), E'\n');
  perform pg_temp.attendre('equivalence-ecf', 'mêmes personnages et mêmes contextes avant et après (lignes)',
    coalesce(array_length(lb, 1), 0)::text, coalesce(array_length(la, 1), 0)::text);
  for i in 1 .. least(coalesce(array_length(la, 1), 0), coalesce(array_length(lb, 1), 0)) loop
    if split_part(la[i], '#', 1) is distinct from split_part(lb[i], '#', 1) then
      v_necart := v_necart + 1;
      v_ecarts := v_ecarts || format('ligne %s : %s contre %s ; ', i, split_part(la[i], '#', 1), split_part(lb[i], '#', 1));
      continue;
    end if;
    ta := string_to_array(split_part(la[i], '#', 2), ',');
    tb := string_to_array(split_part(lb[i], '#', 2), ',');
    if coalesce(array_length(ta, 1), 0) <> coalesce(array_length(tb, 1), 0) then
      v_necart := v_necart + 1;
      v_ecarts := v_ecarts || format('%s : %s contre %s valeurs ; ', split_part(la[i], '#', 1), array_length(ta, 1), array_length(tb, 1));
      continue;
    end if;
    for j in 1 .. coalesce(array_length(ta, 1), 0) loop
      v_ncmp := v_ncmp + 1;
      if ta[j] is distinct from tb[j] then
        v_necart := v_necart + 1;
        if length(v_ecarts) < 600 then
          v_ecarts := v_ecarts || format('%s : %s devient %s ; ', split_part(la[i], '#', 1), ta[j], split_part(tb[j], '=', 2));
        end if;
      end if;
    end loop;
  end loop;
  perform pg_temp.verifier('equivalence-ecf', 'ECF seul : chaque prédicat et geste du noyau rend après les migrations ce qu''il rendait avant l''étape 2a (0 écart)',
    v_necart = 0 and v_ncmp > 1000, left(format('%s écart(s) sur %s comparaisons ; %s', v_necart, v_ncmp, v_ecarts), 700));
  perform pg_temp.informer('equivalence-ecf, comparaisons', format('%s comparaisons, %s écart(s)', v_ncmp, v_necart));
end $cge$;

-- Groupe noyau : chaque personnage, sur une promo et un centre de chaque organisme ; le fondateur hors support ; les gestes.
create or replace function pg_temp.groupe_noyau()
returns void language plpgsql as $cgn$
declare
  v_a text := pg_temp.clo('org_a'); v_b text := pg_temp.clo('org_b');
  v_pa text := pg_temp.clo_n('promo_a'); v_pb text := pg_temp.clo_n('promo_b');
  v_la text := pg_temp.clo_n('lieu_a'); v_lb text := pg_temp.clo_n('lieu_b');
  v_req text; r record; v_promos_a text;
begin
  v_req := format($cgnq$select concat_ws('|', public.est_formateur(%1$s)::text || '/' || public.est_formateur(%2$s)::text,
      public.est_direction(%3$s)::text || '/' || public.est_direction(%4$s)::text, public.est_siege()::text,
      public.peut_acceder_promo(%1$s)::text || '/' || public.peut_acceder_promo(%2$s)::text)$cgnq$, v_pa, v_pb, v_la, v_lb);
  for r in select * from (values
      ('siege_a', 'false/false|false/false|true|false/false'),
      ('dir_a', 'false/false|true/false|false|true/false'),
      ('form_a', 'true/false|false/false|false|true/false'),
      ('stag_a', 'false/false|false/false|false|true/false'),
      ('fond_a', 'true/false|true/false|true|true/false'),
      ('siege_b', 'false/false|false/false|true|false/false'),
      ('dir_b', 'false/false|false/true|false|false/true'),
      ('form_b', 'false/true|false/false|false|false/true'),
      ('stag_b1', 'false/false|false/false|false|false/true'),
      ('stag_b2', 'false/false|false/false|false|false/true')) x(nom, attendu) loop
    perform pg_temp.attendre('noyau', format('%s (jeton et en-tête de sa promo) : est_formateur(promo ECF/B), est_direction(centre ECF/B), est_siege(), peut_acceder_promo(promo ECF/B) vrais seulement chez soi', r.nom),
      pg_temp.clo_lire(r.nom, v_req), 'OK ' || r.attendu);
  end loop;
  -- Le fondateur hors support : ses promos, sa promo par défaut, ses gestes et ses cases.
  v_promos_a := pg_temp.calcul(format('select string_agg(pr.id::text, '','' order by pr.id) from public.promos pr join public.lieux l on l.id = pr.lieu_id where l.organisme_id = %s', v_a));
  perform pg_temp.attendre('noyau', 'fondateur hors support : mes_promos() = les promos d''ECF seulement',
    pg_temp.clo_lire('fond_a', 'select string_agg(id::text, '','' order by id) from public.mes_promos()'), 'OK ' || v_promos_a);
  perform pg_temp.attendre('noyau', 'fondateur hors support : promo_par_defaut() et promo_courante() sans en-tête dans ECF',
    pg_temp.clo_lire('fond_a', 'select public.organisme_de_promo(public.promo_par_defaut())::text || ''/'' || public.organisme_de_promo(public.promo_courante())::text', true),
    'OK ' || v_a || '/' || v_a);
  perform pg_temp.attendre('noyau', 'fondateur hors support, promo et centre de B : aucun geste, aucune case, ni formateur_fixe, direction_fixe, membre_stagiaire',
    pg_temp.clo_lire('fond_a', format($cgnq$select concat_ws('|', public.geste_promo(%1$s, 'stagiaires.supprimer')::text, public.geste_promo(%1$s, 'notes.saisir')::text,
        public.geste_promo(%1$s, 'planning.lire')::text, public.geste_centre(%2$s, 'formateurs.nommer')::text, public.geste_centre(%2$s, 'promos.gerer')::text,
        public.case_promo(%1$s, 'notes'), public.case_centre(%2$s, 'equipe'), public.formateur_fixe(%1$s)::text, public.direction_fixe(%2$s)::text,
        public.membre_stagiaire(%1$s)::text)$cgnq$, v_pb, v_lb)),
    'OK false|false|false|false|false|0|0|false|false|false');
  perform pg_temp.attendre('noyau', 'fondateur hors support, promo et centre d''ECF : gestes et cases au plafond',
    pg_temp.clo_lire('fond_a', format($cgnq$select concat_ws('|', public.geste_promo(%1$s, 'stagiaires.supprimer')::text, public.geste_promo(%1$s, 'notes.saisir')::text,
        public.geste_promo(%1$s, 'planning.lire')::text, public.geste_centre(%2$s, 'formateurs.nommer')::text, public.geste_centre(%2$s, 'promos.gerer')::text,
        public.case_promo(%1$s, 'notes'), public.case_centre(%2$s, 'equipe'), public.formateur_fixe(%1$s)::text, public.direction_fixe(%2$s)::text)$cgnq$, v_pa, v_la)),
    'OK true|true|true|true|true|2|2|true|true');
  -- Formateur et direction : leurs gestes chez eux seulement.
  for r in select * from (values ('form_a', v_pa, v_pb), ('form_b', v_pb, v_pa)) x(nom, chez, ailleurs) loop
    perform pg_temp.attendre('noyau', format('%s : notes.saisir sur sa promo, pas sur celle de l''autre organisme', r.nom),
      pg_temp.clo_lire(r.nom, format('select public.geste_promo(%s, ''notes.saisir'')::text || ''/'' || public.geste_promo(%s, ''notes.saisir'')::text', r.chez, r.ailleurs)),
      'OK true/false');
  end loop;
  for r in select * from (values ('dir_a', v_la, v_lb), ('dir_b', v_lb, v_la)) x(nom, chez, ailleurs) loop
    perform pg_temp.attendre('noyau', format('%s : formateurs.nommer sur son centre, pas sur celui de l''autre organisme', r.nom),
      pg_temp.clo_lire(r.nom, format('select public.geste_centre(%s, ''formateurs.nommer'')::text || ''/'' || public.geste_centre(%s, ''formateurs.nommer'')::text', r.chez, r.ailleurs)),
      'OK true/false');
  end loop;
  -- Le siège : les gestes du réseau dans son organisme, jamais dans l'autre.
  for r in select * from (values ('siege_a', v_a, v_b), ('siege_b', v_b, v_a)) x(nom, chez, ailleurs) loop
    perform pg_temp.attendre('noyau', format('%s : geste_reseau(centres.creer), directions.lire, case_reseau(directions), siege_fixe() sur son organisme courant, qui est le sien ; est_siege_de(l''autre) faux', r.nom),
      pg_temp.clo_lire(r.nom, format($cgnq$select concat_ws('|', public.geste_reseau('centres.creer')::text, public.geste_reseau('directions.lire')::text,
          public.case_reseau('directions'), public.siege_fixe()::text, public.organisme_courant(), public.est_siege_de(%s)::text)$cgnq$, r.ailleurs), true),
      'OK true|true|2|true|' || r.chez || '|false');
  end loop;
  -- Appliqué à l'autre organisme : sous l'en-tête d'une promo d'ECF, le siège de B reste dans B (aucune promo, aucun siège d'ECF).
  perform pg_temp.attendre('noyau', 'siège de B sous l''en-tête x-promo-id d''une promo d''ECF : aucune promo, organisme courant B, est_siege_de(ECF) faux, ses gestes restent ceux de B',
    pg_temp.clo_jouer('siege_b', v_pa, null, format($cgnq$select concat_ws('|', coalesce(public.promo_courante()::text, 'nul'), public.organisme_courant(),
        public.est_siege_de(%s)::text, public.est_siege()::text, public.geste_reseau('centres.creer')::text)$cgnq$, v_a)),
    'OK nul|' || v_b || '|false|true|true');
end $cgn$;

-- Groupe apercu : le fondateur en aperçu, hors support (organisme actif ECF) ou en support (B). p_support : l'organisme actif est B.
create or replace function pg_temp.groupe_apercu(p_support boolean)
returns void language plpgsql as $cga$
declare
  v_a text := pg_temp.clo('org_a'); v_b text := pg_temp.clo('org_b');
  v_pa text := pg_temp.clo_n('promo_a'); v_pb text := pg_temp.clo_n('promo_b');
  v_la text := pg_temp.clo_n('lieu_a'); v_lb text := pg_temp.clo_n('lieu_b');
  v_ici text := case when p_support then v_b else v_a end;
  v_ailleurs text := case when p_support then v_a else v_b end;
  v_p_ici text := case when p_support then v_pb else v_pa end;
  v_p_ailleurs text := case when p_support then v_pa else v_pb end;
  v_l_ici text := case when p_support then v_lb else v_la end;
  v_l_ailleurs text := case when p_support then v_la else v_lb end;
  v_quand text := case when p_support then 'en support sur B' else 'hors support' end;
  v_form text; e text;
begin
  -- Aperçu formateur : la promo affichée est toujours de l'organisme actif ; l'autre n'est jamais formateur.
  v_form := format($cgaq$select concat_ws('|', public.est_formateur(%1$s)::text, public.est_formateur(%2$s)::text, (public.organisme_de_promo(public.promo_courante()) = %3$s)::text,
      (public.promo_courante() = public.promo_par_defaut() or public.promo_courante() = %2$s)::text, (select m.id from public.mon_organisme() m))$cgaq$,
    v_p_ailleurs, v_p_ici, v_ici);
  perform pg_temp.attendre('apercu', format('fondateur %s, aperçu formateur, en-tête de sa promo : formateur de la promo de son organisme actif seulement, mon_organisme() = cet organisme', v_quand),
    pg_temp.clo_jouer('fond_a', v_p_ici, 'formateur', v_form), 'OK false|true|true|true|' || v_ici);
  -- La règle du contrôleur (hors support) : aperçu formateur, en-tête de la promo de B ; et son miroir en support.
  perform pg_temp.attendre('apercu', format('fondateur %s, aperçu formateur, en-tête x-promo-id d''une promo de l''autre organisme : promo_courante() n''est pas cette promo (promo par défaut de l''organisme actif), mon_organisme() = l''organisme actif, est_formateur(cette promo) faux', v_quand),
    pg_temp.clo_jouer('fond_a', v_p_ailleurs, 'formateur', format($cgaq$select concat_ws('|', (coalesce(public.promo_courante(), -1) <> %1$s)::text,
        public.organisme_de_promo(public.promo_courante()), (public.promo_courante() = public.promo_par_defaut())::text,
        (select m.id from public.mon_organisme() m), public.est_formateur(%1$s)::text, public.organisme_courant())$cgaq$, v_p_ailleurs)),
    format('OK true|%s|true|%s|false|%s', v_ici, v_ici, v_ici));
  -- Aperçu direction et stagiaire, en-tête de l'autre organisme : rien de lui.
  perform pg_temp.attendre('apercu', format('fondateur %s, aperçu direction, en-tête d''une promo de l''autre organisme : est_direction(son centre) faux, le centre affiché est de l''organisme actif', v_quand),
    pg_temp.clo_jouer('fond_a', v_p_ailleurs, 'direction', format($cgaq$select concat_ws('|', public.est_direction(%1$s)::text, public.est_direction(public.lieu_courant())::text,
        public.organisme_de_lieu(public.lieu_courant()), public.direction_fixe(%1$s)::text, public.case_centre(%1$s, 'equipe'))$cgaq$, v_l_ailleurs)),
    format('OK false|true|%s|false|0', v_ici));
  perform pg_temp.attendre('apercu', format('fondateur %s, aperçu direction, en-tête de sa promo : direction du centre de l''organisme actif seulement', v_quand),
    pg_temp.clo_jouer('fond_a', v_p_ici, 'direction', format('select public.est_direction(%s)::text || ''/'' || public.est_direction(%s)::text', v_l_ici, v_l_ailleurs)),
    'OK true/false');
  perform pg_temp.attendre('apercu', format('fondateur %s, aperçu stagiaire, en-tête d''une promo de l''autre organisme : membre_stagiaire(cette promo) faux, celui de la promo affichée vrai', v_quand),
    pg_temp.clo_jouer('fond_a', v_p_ailleurs, 'stagiaire', format('select public.membre_stagiaire(%s)::text || ''/'' || public.membre_stagiaire(public.promo_courante())::text', v_p_ailleurs)),
    'OK false/true');
  -- Aperçu siège, sans en-tête puis sous l'en-tête d'une promo de l'autre organisme : siège de l'organisme actif seulement.
  foreach e in array array[null, v_p_ailleurs] loop
    perform pg_temp.attendre('apercu', format('fondateur %s, aperçu siège, %s : est_siege(), est_siege_de(organisme actif), est_siege_de(l''autre), organisme courant, case_reseau(directions), aucune promo',
        v_quand, case when e is null then 'sans en-tête' else 'en-tête d''une promo de l''autre organisme' end),
      pg_temp.clo_jouer('fond_a', e, 'siege', format($cgaq$select concat_ws('|', public.est_siege()::text, public.est_siege_de(%s)::text, public.est_siege_de(%s)::text,
          public.organisme_courant(), public.case_reseau('directions'), coalesce(public.promo_courante()::text, 'nul'))$cgaq$, v_ici, v_ailleurs)),
      format('OK true|true|false|%s|2|nul', v_ici));
  end loop;
end $cga$;

-- Groupe support : un support ouvert sur B, puis fermé, puis une ligne antidatée dont l'échéance est passée (l'horloge de la
-- transaction ne bouge pas : un support échu est une ligne dont ferme_le est déjà passé, jamais fermée en avance).
create or replace function pg_temp.groupe_support()
returns void language plpgsql as $cgs$
declare
  v_a text := pg_temp.clo('org_a'); v_b text := pg_temp.clo('org_b');
  v_pa text := pg_temp.clo_n('promo_a'); v_pb text := pg_temp.clo_n('promo_b');
  v_la text := pg_temp.clo_n('lieu_a'); v_lb text := pg_temp.clo_n('lieu_b');
  v_promos_a text; v_promos_b text; v text;
begin
  v_promos_a := pg_temp.calcul(format('select string_agg(pr.id::text, '','' order by pr.id) from public.promos pr join public.lieux l on l.id = pr.lieu_id where l.organisme_id = %s', v_a));
  v_promos_b := pg_temp.calcul(format('select string_agg(pr.id::text, '','' order by pr.id) from public.promos pr join public.lieux l on l.id = pr.lieu_id where l.organisme_id = %s', coalesce(v_b, 'null')));
  perform pg_temp.attendre('support', 'le fondateur ouvre un support sur B (1 heure)',
    pg_temp.clo_lire('fond_a', format($cgsq$select (public.ouvrir_acces_support(%s, 'Support de la preuve du noyau', '1 hour')).organisme_id::text$cgsq$, coalesce(v_b, 'null'))),
    'OK ' || v_b);
  perform pg_temp.attendre('support', 'en support : mes_promos() = les promos de B seulement (sa fiche stagiaire d''ECF comprise, plus listée)',
    pg_temp.clo_lire('fond_a', 'select string_agg(id::text, '','' order by id) from public.mes_promos()'), 'OK ' || v_promos_b);
  perform pg_temp.attendre('support', 'en support : est_siege() vrai, est_siege_de(B) vrai, est_siege_de(ECF) faux, organisme courant B',
    pg_temp.clo_lire('fond_a', format('select concat_ws(''|'', public.est_siege()::text, public.est_siege_de(%s)::text, public.est_siege_de(%s)::text, public.organisme_courant())', v_b, v_a), true),
    'OK true|true|false|' || v_b);
  perform pg_temp.attendre('support', 'en support : est_formateur, est_direction, peut_acceder_promo (ECF/B) vrais sur B seulement',
    pg_temp.clo_lire('fond_a', format($cgsq$select concat_ws('|', public.est_formateur(%1$s)::text || '/' || public.est_formateur(%2$s)::text,
        public.est_direction(%3$s)::text || '/' || public.est_direction(%4$s)::text,
        public.peut_acceder_promo(%1$s)::text || '/' || public.peut_acceder_promo(%2$s)::text)$cgsq$, v_pa, v_pb, v_la, v_lb)),
    'OK false/true|false/true|false/true');
  perform pg_temp.attendre('support', 'en support : promo_par_defaut() et promo_courante() sans en-tête = la promo de B',
    pg_temp.clo_lire('fond_a', 'select public.promo_par_defaut()::text || ''/'' || public.promo_courante()::text'), 'OK ' || v_pb || '/' || v_pb);
  perform pg_temp.attendre('support', 'en support, en-tête x-promo-id d''une promo d''ECF : promo_courante() = la promo de B, est_formateur(ECF) faux, aucun geste sur ECF',
    pg_temp.clo_jouer('fond_a', v_pa, null, format($cgsq$select concat_ws('|', public.promo_courante(), public.est_formateur(%1$s)::text, public.geste_promo(%1$s, 'notes.saisir')::text,
        public.membre_stagiaire(%1$s)::text)$cgsq$, v_pa)),
    'OK ' || v_pb || '|false|false|false');
  perform pg_temp.attendre('support', 'en support : gestes et cases sur B ouverts (promo, centre, réseau), sur ECF fermés',
    pg_temp.clo_lire('fond_a', format($cgsq$select concat_ws('|', public.geste_promo(%1$s, 'stagiaires.supprimer')::text, public.geste_centre(%2$s, 'formateurs.nommer')::text,
        public.geste_reseau('centres.creer')::text, public.case_reseau('directions'), public.siege_fixe()::text,
        public.geste_promo(%3$s, 'stagiaires.supprimer')::text, public.geste_centre(%4$s, 'formateurs.nommer')::text, public.case_promo(%3$s, 'notes'), public.case_centre(%4$s, 'equipe'))$cgsq$,
      v_pb, v_lb, v_pa, v_la)),
    'OK true|true|true|2|true|false|false|0|0');
  -- L'aperçu pendant le support (Review Focus 3).
  perform pg_temp.groupe_apercu(true);
  -- Fermeture, puis support échu : une ligne sur B ouverte il y a 2 heures, échue depuis une seconde (posée en propriétaire, sous le
  -- marqueur que pose ouvrir_acces_support).
  perform pg_temp.attendre('support', 'fermer_acces_support() par le fondateur',
    pg_temp.clo_lire('fond_a', 'select ''fait'' from public.fermer_acces_support() f'), 'OK fait');
  v := pg_temp.clo_ecrire(null, format($cgsq$with m as (select set_config('cloisonnement.journal_fondateur', 'oui', true) as x)
      insert into public.acces_fondateur (email, organisme_id, ouvert_le, ferme_le, motif, ouvert_par)
      select %L, %s, now() - interval '2 hours', now() - interval '1 second', 'Support échu de la preuve du noyau', 'preuve' from m$cgsq$,
    (select email from pg_temp.clo_perso where nom = 'fond_a'), coalesce(v_b, 'null')));
  perform set_config('cloisonnement.journal_fondateur', '', true);
  perform pg_temp.attendre('support', 'ligne de support antidatée posée : échéance passée, aucun support ouvert',
    v || ' ; ' || pg_temp.calcul(format($cgsq$select count(*) filter (where ferme_le > now())::text || '/' || count(*) filter (where motif = 'Support échu de la preuve du noyau' and ferme_le < now())::text
      from public.acces_fondateur where email = %L and motif is not null$cgsq$, (select email from pg_temp.clo_perso where nom = 'fond_a'))),
    'OK 1 ; 0/1');
  perform pg_temp.attendre('support', 'après échéance : organisme actif, organisme courant et mon_organisme() sur ECF, sans échéance',
    pg_temp.clo_lire('fond_a', 'select concat_ws(''|'', public.organisme_actif_fondateur(), public.organisme_courant(), (select concat_ws('':'', m.id, coalesce(m.support_jusqua::text, ''aucune'')) from public.mon_organisme() m))', true),
    format('OK %s|%s|%s:aucune', v_a, v_a, v_a));
  perform pg_temp.attendre('support', 'après échéance : mes_promos() = les promos d''ECF seulement',
    pg_temp.clo_lire('fond_a', 'select string_agg(id::text, '','' order by id) from public.mes_promos()'), 'OK ' || v_promos_a);
  perform pg_temp.attendre('support', 'après échéance, en-tête x-promo-id de la promo de B (session ouverte pendant le support) : promo_courante() = promo_par_defaut() d''ECF, sans erreur ; est_formateur(B) et est_siege_de(B) faux',
    pg_temp.clo_jouer('fond_a', v_pb, null, format($cgsq$select concat_ws('|', (public.promo_courante() = public.promo_par_defaut())::text, public.organisme_de_promo(public.promo_courante()),
        public.organisme_courant(), public.est_formateur(%1$s)::text, public.est_siege_de(%2$s)::text, public.est_siege_de(%3$s)::text)$cgsq$, v_pb, coalesce(v_b, 'null'), v_a)),
    format('OK true|%s|%s|false|false|true', v_a, v_a));
  perform pg_temp.attendre('support', 'après échéance : est_formateur, est_direction, peut_acceder_promo (ECF/B) vrais sur ECF seulement',
    pg_temp.clo_lire('fond_a', format($cgsq$select concat_ws('|', public.est_formateur(%1$s)::text || '/' || public.est_formateur(%2$s)::text,
        public.est_direction(%3$s)::text || '/' || public.est_direction(%4$s)::text,
        public.peut_acceder_promo(%1$s)::text || '/' || public.peut_acceder_promo(%2$s)::text)$cgsq$, v_pa, v_pb, v_la, v_lb)),
    'OK true/false|true/false|true/false');
end $cgs$;

-- Une lecture jouée par le propriétaire avec le contexte d'un personnage, en aperçu (x-apercu-role) et sous un en-tête x-apercu-titre
-- choisis : « OK <valeur> » ou « ERREUR <état> <message> » (apercu_titre lit ces en-têtes).
create or replace function pg_temp.clo_jouer_titre(p_nom text, p_apercu text, p_titre text, p_sql text)
returns text language plpgsql as $cjt$
declare v text; r text;
begin
  perform pg_temp.contexte((select p.email from pg_temp.clo_perso p where p.nom = p_nom), null, p_apercu);
  perform set_config('request.headers', jsonb_strip_nulls(jsonb_build_object('x-apercu-role', p_apercu, 'x-apercu-titre', p_titre))::text, true);
  begin
    execute p_sql into v;
    r := rtrim('OK ' || coalesce(v, 'nul'));
  exception when others then
    r := 'ERREUR ' || sqlstate || ' ' || sqlerrm;
  end;
  perform pg_temp.proprio();
  return r;
end $cjt$;

-- L'organisme d'une affectation, relu par le propriétaire (siège : sa colonne ; direction : son centre ; formateur : sa promo).
create or replace function pg_temp.clo_org_affectation()
returns text language sql as $coa$
  select 'coalesce(a.organisme_id, public.organisme_de_lieu(a.lieu_id), public.organisme_de_promo(a.promo_id))';
$coa$;

-- Groupe siege (étape 2b) : le siège de B, celui d'ECF et le fondateur hors support ne voient, ne comptent et ne créent que dans leur
-- organisme : comptes_reseau(), creer_centre(), lieux et affectations lus, roles_du_personnel(), inviter_compte (direction et siège),
-- habillage du réseau.
create or replace function pg_temp.groupe_siege()
returns void language plpgsql as $cgsi$
declare
  v_a text := pg_temp.clo_n('org_a'); v_b text := pg_temp.clo_n('org_b');
  v_la text := pg_temp.clo_n('lieu_a'); v_lb text := pg_temp.clo_n('lieu_b');
  r record; v text; v_ids text; v_dirs text; v_lieu_cree text;
begin
  for r in select * from (values ('siege_a', v_a, v_b, 'A'), ('siege_b', v_b, v_a, 'B'), ('fond_a', v_a, v_b, 'F')) x(nom, chez, ailleurs, suffixe) loop
    -- creer_centre : le centre naît dans l'organisme de l'appelant.
    v := pg_temp.clo_lire(r.nom, format('select public.creer_centre(%L)::text', 'Preuve clo siège centre ' || r.suffixe));
    v_lieu_cree := case when v ~ '^OK [0-9]+$' then substr(v, 4) else 'null' end;
    perform pg_temp.attendre('siege', format('%s : creer_centre() crée le centre dans son organisme', r.nom),
      left(v, 3) || pg_temp.calcul(format('select coalesce(organisme_id::text, ''nul'') from public.lieux where id = %s', v_lieu_cree)), 'OK ' || r.chez);
    -- Les centres de son organisme, et eux seuls : comptes_reseau(), puis la table lieux.
    v_ids := pg_temp.calcul(format('select coalesce(string_agg(id::text, '','' order by id), ''aucun'') from public.lieux where organisme_id = %s', r.chez));
    perform pg_temp.attendre('siege', format('%s : comptes_reseau() rend les centres de son organisme, et eux seuls (le centre créé compris)', r.nom),
      pg_temp.clo_lire(r.nom, 'select coalesce(string_agg(lieu_id::text, '','' order by lieu_id), ''aucun'') from public.comptes_reseau()'), 'OK ' || v_ids);
    perform pg_temp.attendre('siege', format('%s : lieux lus = les centres de son organisme, et eux seuls', r.nom),
      pg_temp.clo_lire(r.nom, 'select coalesce(string_agg(id::text, '','' order by id), ''aucun'') from public.lieux'), 'OK ' || v_ids);
    -- Affectations : aucune ligne de l'autre organisme ; toutes les directions du sien.
    v_ids := pg_temp.calcul(format('select coalesce(array_agg(a.id), ''{}'')::text from public.affectations a where %s = %s', pg_temp.clo_org_affectation(), r.ailleurs));
    v_dirs := pg_temp.calcul(format('select count(*)::text from public.affectations a where a.role = ''direction'' and %s = %s', pg_temp.clo_org_affectation(), r.chez));
    perform pg_temp.attendre('siege', format('%s : affectations lues, aucune de l''autre organisme / toutes les directions du sien', r.nom),
      pg_temp.clo_lire(r.nom, format('select (count(*) filter (where id = any (%L::bigint[])))::text || ''/'' || (count(*) filter (where role = ''direction''))::text from public.affectations', v_ids)),
      'OK 0/' || v_dirs);
    -- roles_du_personnel() : les directions et sièges de son organisme, exactement.
    v_ids := pg_temp.calcul(format($q$select coalesce(string_agg(x.e || ':' || x.r, ',' order by x.e, x.r), 'aucun') from (select distinct lower(a.email)::text as e, a.role::text as r
        from public.affectations a where a.role in ('direction', 'siege') and %s = %s) x$q$, pg_temp.clo_org_affectation(), r.chez));
    perform pg_temp.attendre('siege', format('%s : roles_du_personnel() nomme les directions et les sièges de son organisme, exactement (personne de l''autre)', r.nom),
      pg_temp.clo_lire(r.nom, 'select coalesce(string_agg(email || '':'' || role, '','' order by email, role), ''aucun'') from public.roles_du_personnel()'), 'OK ' || v_ids);
  end loop;

  -- inviter_compte, branche direction : un centre de son organisme seulement (un centre de l'autre organisme est traité comme absent).
  for r in select * from (values ('siege_a', v_la, v_lb, 'a'), ('siege_b', v_lb, v_la, 'b'), ('fond_a', v_la, v_lb, 'f')) x(nom, chez, ailleurs, suffixe) loop
    perform pg_temp.attendre('siege', format('%s : inviter une direction sur un centre de l''autre organisme est refusé (« Le centre est requis. »), rien n''est écrit', r.nom),
      pg_temp.clo_lire(r.nom, format('select public.inviter_compte(%L, ''direction'', null, null, %s)::text', 'preuve.clo.inv.dir.' || r.suffixe || '@exemple.invalid', r.ailleurs))
        || ' ; ' || pg_temp.calcul(format('select count(*)::text from public.affectations where email = %L', 'preuve.clo.inv.dir.' || r.suffixe || '@exemple.invalid')),
      'ERREUR P0001 invitation: Le centre est requis. ; 0');
    perform pg_temp.attendre('siege', format('%s : inviter une direction sur un centre de son organisme est accepté', r.nom),
      left(pg_temp.clo_lire(r.nom, format('select public.inviter_compte(%L, ''direction'', null, null, %s)::text', 'preuve.clo.inv.dir.' || r.suffixe || '@exemple.invalid', r.chez)), 3)
        || pg_temp.calcul(format('select string_agg(lieu_id::text, '','') from public.affectations where email = %L', 'preuve.clo.inv.dir.' || r.suffixe || '@exemple.invalid')),
      'OK ' || r.chez);
  end loop;
  -- inviter_compte, branche siège : le fondateur seul, sur son organisme actif (ECF hors support, B en support).
  perform pg_temp.attendre('siege', 'fondateur hors support : le siège invité est celui d''ECF',
    left(pg_temp.clo_lire('fond_a', $q$select public.inviter_compte('preuve.clo.inv.siege.f1@exemple.invalid', 'siege')::text$q$), 3)
      || pg_temp.org_de('affectations', $q$email = 'preuve.clo.inv.siege.f1@exemple.invalid' and role = 'siege'$q$),
    'OK ' || v_a);
  perform pg_temp.attendre('siege', 'le siège de B ne nomme pas de siège (« Réservé au fondateur. »)',
    pg_temp.clo_lire('siege_b', $q$select public.inviter_compte('preuve.clo.inv.siege.b1@exemple.invalid', 'siege')::text$q$),
    'ERREUR 42501 invitation: Réservé au fondateur.');
  perform pg_temp.attendre('siege', 'fondateur en support sur B : le siège invité est celui de B',
    left(pg_temp.clo_lire('fond_a', format($q$select (public.ouvrir_acces_support(%s, 'Support de la preuve du siège', '1 hour')).organisme_id::text$q$, v_b)), 3)
      || left(pg_temp.clo_lire('fond_a', $q$select public.inviter_compte('preuve.clo.inv.siege.f2@exemple.invalid', 'siege')::text$q$), 3)
      || pg_temp.org_de('affectations', $q$email = 'preuve.clo.inv.siege.f2@exemple.invalid' and role = 'siege'$q$)
      || ' ; ' || pg_temp.clo_lire('fond_a', 'select ''fermé'' from public.fermer_acces_support() f'),
    'OK OK ' || v_b || ' ; OK fermé');

  -- L'habillage du réseau : celui de l'organisme courant ; régler celui de B ne touche ni ECF ni la clé globale.
  v := pg_temp.calcul(format($q$select concat_ws('|', coalesce((select habillage from public.organismes where id = %s), 'nul'),
      coalesce((select value from public.settings where promo_id is null and key = 'habillage_reseau'), 'nul'))$q$, v_a));
  perform pg_temp.attendre('siege', 'le siège de B règle l''habillage du réseau (ecf) : celui de B change ; celui d''ECF et la clé globale (habillage ECF | clé) restent',
    pg_temp.clo_lire('siege_b', $q$select public.regler_habillage_reseau('ecf')::text$q$)
      || ' ; ' || pg_temp.calcul(format('select coalesce(habillage, ''nul'') from public.organismes where id = %s', v_b))
      || ' ; ' || pg_temp.calcul(format($q$select concat_ws('|', coalesce((select habillage from public.organismes where id = %s), 'nul'),
          coalesce((select value from public.settings where promo_id is null and key = 'habillage_reseau'), 'nul'))$q$, v_a)),
    'OK {"habillage": "ecf"} ; ecf ; ' || v);
  perform pg_temp.attendre('siege', 'le siège d''ECF règle l''habillage du réseau (ecsr) : celui d''ECF et la clé globale (iPhone en cache) changent, celui de B reste ecf',
    pg_temp.clo_lire('siege_a', $q$select public.regler_habillage_reseau('ecsr')::text$q$)
      || ' ; ' || pg_temp.calcul(format($q$select concat_ws('|', (select habillage from public.organismes where id = %s),
          (select value from public.settings where promo_id is null and key = 'habillage_reseau'), (select habillage from public.organismes where id = %s))$q$, v_a, v_b)),
    'OK {"habillage": "ecsr"} ; ecsr|ecsr|ecf');
  perform pg_temp.attendre('siege', 'habillage_par_defaut() : un stagiaire de B lit celui de B, un stagiaire d''ECF celui d''ECF (stag_b1 / stag_a)',
    pg_temp.clo_lire('stag_b1', 'select coalesce(reseau, ''nul'') from public.habillage_par_defaut()') || ' / '
      || pg_temp.clo_lire('stag_a', 'select coalesce(reseau, ''nul'') from public.habillage_par_defaut()'),
    'OK ecf / OK ecsr');
  perform pg_temp.attendre('siege', 'une valeur abîmée de la clé globale écrite en propriétaire se recopie sur ECF seulement, lue comme absente (déclencheur miroir) : ECF | B',
    pg_temp.calcul($q$with m as (update public.settings set value = 'rose' where promo_id is null and key = 'habillage_reseau' returning 1) select count(*)::text from m$q$)
      || ' ; ' || pg_temp.calcul(format('select concat_ws(''|'', coalesce((select habillage from public.organismes where id = %s), ''nul''), (select habillage from public.organismes where id = %s))', v_a, v_b)),
    '1 ; nul|ecf');
end $cgsi$;

-- Groupe titres (étape 2b) : le siège de B ne voit, ne donne, n'ajuste, ne supprime ni ne copie aucun titre du réseau d'ECF ; le
-- fondateur hors support ne touche ni aux titres ni aux sièges de B ; personnes_et_titres et journal_des_droits : rien de l'autre
-- organisme ; un titre réseau de B donné crée une affectation siège sur B ; apercu_titre() n'accepte pas un titre de B hors support.
create or replace function pg_temp.groupe_titres()
returns void language plpgsql as $cgti$
declare
  v_a text := pg_temp.clo_n('org_a'); v_b text := pg_temp.clo_n('org_b');
  v_la text := pg_temp.clo_n('lieu_a'); v_lb text := pg_temp.clo_n('lieu_b');
  v_tb text := pg_temp.clo_n('titre_b');
  v_titres_a text; v_titres_b text; v_ta text; v_tca text; v_siege_fixe text; v_dir_fixe text;
  v_emails_a text; v_emails_b text; v_lieux_a text; v_lieux_b text; r record; v text;
  c_introuvable constant text := 'ERREUR P0001 titres: Titre introuvable.';
begin
  -- Le verrou des titres non fixes (global) ouvert le temps de la preuve.
  perform pg_temp.essai($q$insert into public.settings (key, value, promo_id) values ('titres_ouverts', 'oui', null)
    on conflict (promo_id, key) do update set value = excluded.value$q$);
  v_titres_a := pg_temp.calcul(format('select coalesce(array_agg(id order by id), ''{}'')::text from public.titres where lieu_id is null and not fixe and organisme_id = %s', v_a));
  v_titres_b := pg_temp.calcul(format('select coalesce(array_agg(id order by id), ''{}'')::text from public.titres where lieu_id is null and not fixe and organisme_id = %s', v_b));
  v_ta := coalesce(pg_temp.calcul(format('select min(id)::text from public.titres where niveau = ''reseau'' and not fixe and organisme_id = %s', v_a)), 'null');
  v_tca := coalesce(pg_temp.calcul(format('select min(id)::text from public.titres where niveau = ''centre'' and lieu_id is null and not fixe and organisme_id = %s', v_a)), 'null');
  v_siege_fixe := coalesce(pg_temp.calcul('select id::text from public.titres where fixe and niveau = ''reseau'''), 'null');
  v_dir_fixe := coalesce(pg_temp.calcul('select id::text from public.titres where fixe and niveau = ''centre'''), 'null');
  v_emails_a := pg_temp.calcul(format('select coalesce(array_agg(distinct lower(a.email)), ''{}'')::text from public.affectations a where %s = %s', pg_temp.clo_org_affectation(), v_a));
  v_emails_b := pg_temp.calcul(format('select coalesce(array_agg(distinct lower(a.email)), ''{}'')::text from public.affectations a where %s = %s', pg_temp.clo_org_affectation(), v_b));
  v_lieux_a := pg_temp.calcul(format('select coalesce(array_agg(id), ''{}'')::text from public.lieux where organisme_id = %s', v_a));
  v_lieux_b := pg_temp.calcul(format('select coalesce(array_agg(id), ''{}'')::text from public.lieux where organisme_id = %s', v_b));
  perform pg_temp.informer('titres du réseau', format('ECF %s ; B %s ; titre réseau d''ECF %s, titre de centre du réseau d''ECF %s', v_titres_a, v_titres_b, v_ta, v_tca));

  -- Voir : au réseau, les titres fixes et ceux de son organisme ; dans un centre, de même ; le centre d'un autre organisme est fermé.
  for r in select * from (values ('siege_a', v_titres_a, v_titres_b), ('siege_b', v_titres_b, v_titres_a)) x(nom, chez, ailleurs) loop
    perform pg_temp.attendre('titres', format('%s : titres_visibles(réseau) rend les 3 titres fixes et les titres du réseau de son organisme, aucun de l''autre (fixes / siens / autres)', r.nom),
      pg_temp.clo_lire(r.nom, format('select (count(*) filter (where fixe))::text || ''/'' || (count(*) filter (where id = any (%L::bigint[])))::text || ''/'' || (count(*) filter (where id = any (%L::bigint[])))::text from public.titres_visibles(null)', r.chez, r.ailleurs)),
      'OK 3/' || pg_temp.calcul(format('select cardinality(%L::bigint[])::text', r.chez)) || '/0');
    perform pg_temp.attendre('titres', format('%s : titres_ajustables(réseau) : aucun titre de l''autre organisme', r.nom),
      pg_temp.clo_lire(r.nom, format('select (count(*) filter (where id = any (%L::bigint[])))::text from public.titres_ajustables(null)', r.ailleurs)), 'OK 0');
  end loop;
  perform pg_temp.attendre('titres', 'siège de B : les porteurs du titre fixe Siège sont comptés dans B seulement',
    pg_temp.clo_lire('siege_b', format('select porteurs::text from public.titres_visibles(null) where id = %s', v_siege_fixe)),
    'OK ' || pg_temp.calcul(format('select count(distinct lower(email))::text from public.affectations where titre_id = %s and organisme_id = %s', v_siege_fixe, v_b)));
  for r in select * from (values ('dir_b', v_lb), ('siege_b', v_lb), ('dir_a', v_la)) x(nom, lieu) loop
    perform pg_temp.attendre('titres', format('%s : titres_visibles(son centre) : aucun titre du réseau de l''autre organisme', r.nom),
      pg_temp.clo_lire(r.nom, format('select (count(*) filter (where id = any (%L::bigint[])))::text from public.titres_visibles(%s)',
        case when r.nom like '%_b' then v_titres_a else v_titres_b end, r.lieu)), 'OK 0');
  end loop;
  perform pg_temp.attendre('titres', 'siège de B : titres_visibles d''un centre d''ECF refusé (42501)',
    pg_temp.clo_lire('siege_b', format('select count(*)::text from public.titres_visibles(%s)', v_la)), 'ERREUR 42501 titres: Réservé à l''équipe du centre.');

  -- Donner, ajuster, supprimer, copier un titre d'ECF : « Titre introuvable. », rien n'est écrit.
  perform pg_temp.attendre('titres', 'siège de B : donner un titre réseau d''ECF est refusé (« Titre introuvable. »), aucune affectation',
    pg_temp.clo_lire('siege_b', format($q$select public.donner_titre('preuve.clo.titre.cible@exemple.invalid', %s, null)::text$q$, v_ta))
      || ' ; ' || pg_temp.calcul($q$select count(*)::text from public.affectations where email = 'preuve.clo.titre.cible@exemple.invalid'$q$),
    c_introuvable || ' ; 0');
  perform pg_temp.attendre('titres', 'direction de B : donner dans son centre un titre du réseau d''ECF (niveau centre) est refusé (« Titre introuvable. »)',
    pg_temp.clo_lire('dir_b', format($q$select public.donner_titre('preuve.clo.titre.cible@exemple.invalid', %s, %s)::text$q$, v_tca, v_lb))
      || ' ; ' || pg_temp.calcul($q$select count(*)::text from public.affectations where email = 'preuve.clo.titre.cible@exemple.invalid'$q$),
    c_introuvable || ' ; 0');
  v := pg_temp.calcul(format('select nom || ''|'' || cases::text from public.titres where id = %s', v_ta));
  perform pg_temp.attendre('titres', 'siège de B : ajuster un titre réseau d''ECF est refusé (« Titre introuvable. »), nom et cases inchangés',
    pg_temp.clo_lire('siege_b', format($q$select public.ajuster_titre(%s, null, 'Preuve clo renommé', '{}')::text$q$, v_ta))
      || ' ; ' || (pg_temp.calcul(format('select nom || ''|'' || cases::text from public.titres where id = %s', v_ta)) = v)::text,
    c_introuvable || ' ; true');
  perform pg_temp.attendre('titres', 'siège de B : supprimer un titre réseau d''ECF est refusé (« Titre introuvable. »), le titre reste',
    pg_temp.clo_lire('siege_b', format('select ''supprimé'' from public.supprimer_titre(%s) f', v_ta))
      || ' ; ' || pg_temp.calcul(format('select count(*)::text from public.titres where id = %s', v_ta)),
    c_introuvable || ' ; 1');
  perform pg_temp.attendre('titres', 'siège de B : copier un titre réseau d''ECF (creer_titre depuis lui) est refusé (« Titre introuvable. »)',
    pg_temp.clo_lire('siege_b', format($q$select public.creer_titre(%s, 'Preuve clo copie', null)::text$q$, v_ta)), c_introuvable);
  -- Donner un titre réseau de B : l'affectation siège est sur B.
  perform pg_temp.attendre('titres', 'siège de B : donner le titre réseau de B crée une affectation siège sur B (organisme | titre)',
    left(pg_temp.clo_lire('siege_b', format($q$select public.donner_titre('preuve.clo.titre.b.nouveau@exemple.invalid', %s, null)::text$q$, v_tb)), 3)
      || pg_temp.calcul($q$select string_agg(organisme_id || '|' || titre_id, ',') from public.affectations where email = 'preuve.clo.titre.b.nouveau@exemple.invalid' and role = 'siege'$q$),
    'OK ' || v_b || '|' || v_tb);

  -- Le fondateur hors support : ni les titres ni les sièges de B.
  perform pg_temp.attendre('titres', 'fondateur hors support : retirer le titre fixe Siège au siège de B est refusé (« n''a pas ce titre ici »), l''affectation de B reste',
    pg_temp.clo_lire('fond_a', format($q$select public.retirer_titre('preuve.clo.siege.b@exemple.invalid', %s, null)::text$q$, v_siege_fixe))
      || ' ; ' || pg_temp.calcul($q$select count(*)::text from public.affectations where email = 'preuve.clo.siege.b@exemple.invalid' and role = 'siege'$q$),
    'ERREUR P0001 titres: Cette personne n''a pas ce titre ici. ; 1');
  perform pg_temp.attendre('titres', 'fondateur hors support : donner, ajuster ou supprimer le titre réseau de B est refusé (« Titre introuvable. »)',
    pg_temp.clo_lire('fond_a', format($q$select public.donner_titre('preuve.clo.titre.cible@exemple.invalid', %s, null)::text$q$, v_tb)) || ' ; '
      || pg_temp.clo_lire('fond_a', format($q$select public.ajuster_titre(%s, null, 'Preuve clo renommé', '{}')::text$q$, v_tb)) || ' ; '
      || pg_temp.clo_lire('fond_a', format('select ''supprimé'' from public.supprimer_titre(%s) f', v_tb)),
    c_introuvable || ' ; ' || c_introuvable || ' ; ' || c_introuvable);
  perform pg_temp.attendre('titres', 'fondateur hors support : créer un titre dans un centre de B est refusé (42501)',
    pg_temp.clo_lire('fond_a', format($q$select public.creer_titre(%s, 'Preuve clo titre fondateur', %s)::text$q$, v_dir_fixe, v_lb)),
    'ERREUR 42501 titres: Réservé à l''équipe du centre.');

  -- Lire les personnes et le journal : rien de l'autre organisme.
  for r in select * from (values ('siege_a', v_a, v_emails_b, v_lieux_b, false), ('siege_b', v_b, v_emails_a, v_lieux_a, false),
                                 ('fond_a', v_a, v_emails_b, v_lieux_b, true)) x(nom, chez, emails_ailleurs, lieux_ailleurs, tout) loop
    perform pg_temp.attendre('titres', format('%s : personnes_et_titres(réseau) : aucune personne de l''autre organisme, au moins une du sien', r.nom),
      pg_temp.clo_lire(r.nom, format('select (count(*) filter (where email = any (%L::text[])))::text || ''/'' || (count(*) > 0)::text from public.personnes_et_titres(null, null)', r.emails_ailleurs)),
      'OK 0/true');
    v := pg_temp.calcul(format($q$select count(*)::text from public.journal_droits j where j.organisme_id = %s and j.quand >= now() - interval '3 years'
        and (%s or j.niveau in ('centre', 'reseau'))$q$, r.chez, r.tout::text));
    perform pg_temp.attendre('titres', format('%s : journal_des_droits(réseau) = les lignes de son organisme (%s), aucune d''un centre de l''autre', r.nom,
        case when r.tout then 'tous niveaux' else 'niveaux centre et réseau' end),
      pg_temp.clo_lire(r.nom, format('select count(*)::text || ''/'' || (count(*) filter (where lieu_id = any (%L::integer[])))::text from public.journal_des_droits(null)', r.lieux_ailleurs)),
      'OK ' || v || '/0');
  end loop;
  perform pg_temp.verifier('titres', 'le journal de B n''est pas vide (le contrôle ci-dessus ne passe pas à vide)',
    pg_temp.calcul(format('select (count(*) > 0)::text from public.journal_droits where organisme_id = %s', v_b)) = 'true', '');

  -- apercu_titre() (règle du contrôleur) : hors support, l'aperçu siège sur un titre réseau de B est ignoré (cases du siège fixe, jamais
  -- celles du titre de B) ; sur un titre réseau d'ECF, il est retenu (le témoin : l'en-tête est bien lu).
  perform pg_temp.attendre('titres', 'fondateur hors support, aperçu siège sur le titre réseau de B : apercu_titre() nul, case_reseau(directions) au plafond',
    pg_temp.clo_jouer_titre('fond_a', 'siege', v_tb, $q$select concat_ws('|', coalesce(public.apercu_titre()::text, 'nul'), public.case_reseau('directions'))$q$),
    'OK nul|2');
  perform pg_temp.attendre('titres', 'fondateur hors support, aperçu siège sur un titre réseau d''ECF : apercu_titre() = ce titre (témoin)',
    pg_temp.clo_jouer_titre('fond_a', 'siege', v_ta, 'select public.apercu_titre()::text'), 'OK ' || v_ta);
end $cgti$;

-- Groupe noms (étape 2b, Review Focus 4) : les noms de centres et de titres du réseau sont uniques dans un organisme, plus dans la base.
create or replace function pg_temp.groupe_noms()
returns void language plpgsql as $cgno$
declare
  v_a text := pg_temp.clo_n('org_a'); v_b text := pg_temp.clo_n('org_b');
  v_la text := pg_temp.clo_n('lieu_a'); v_lb text := pg_temp.clo_n('lieu_b');
  v_tb text := pg_temp.clo_n('titre_b');
  v_nom text; v_titre text; v_tca text; v text; v_dir_fixe text;
begin
  -- Les objets de B posés par les aides portent déjà le nom d'un objet d'ECF.
  perform pg_temp.attendre('noms', 'le centre de B porte le nom du centre de la promo 1 d''ECF (organismes distincts)',
    pg_temp.calcul(format('select (select string_agg(organisme_id::text, '','' order by organisme_id) from public.lieux where lower(nom) = lower(l.nom)) from public.lieux l where l.id = %s', v_la)),
    v_a || ',' || v_b);
  perform pg_temp.attendre('noms', 'le titre réseau de B porte le nom d''un titre réseau d''ECF (organismes distincts)',
    pg_temp.calcul(format('select (select string_agg(organisme_id::text, '','' order by organisme_id) from public.titres where lieu_id is null and lower(nom) = lower(t.nom)) from public.titres t where t.id = %s', v_tb)),
    v_a || ',' || v_b);
  -- Centre : un nom d'ECF (« Nîmes » en production) créé par le siège de B, puis les doublons.
  v_nom := pg_temp.calcul(format($q$select l.nom from public.lieux l where l.organisme_id = %s
      and not exists (select 1 from public.lieux m where m.organisme_id = %s and lower(m.nom) = lower(l.nom))
      order by (l.nom = 'Nîmes') desc, l.id limit 1$q$, v_a, v_b));
  perform pg_temp.informer('noms, centre', format('nom d''un centre d''ECF repris par B : %s', coalesce(v_nom, 'aucun')));
  perform pg_temp.attendre('noms', 'le siège de B crée un centre au nom d''un centre d''ECF : accepté, dans B',
    left(pg_temp.clo_lire('siege_b', format('select public.creer_centre(%L)::text', v_nom)), 3)
      || pg_temp.calcul(format('select string_agg(organisme_id::text, '','' order by organisme_id) from public.lieux where lower(nom) = lower(%L)', v_nom)),
    'OK ' || v_a || ',' || v_b);
  perform pg_temp.attendre('noms', 'le siège de B recrée ce nom en capitales : refusé (doublon dans B)',
    pg_temp.clo_lire('siege_b', format('select public.creer_centre(%L)::text', upper(v_nom))), 'ERREUR P0001 centre: Ce centre existe déjà.');
  perform pg_temp.attendre('noms', 'le siège d''ECF recrée ce nom en minuscules : refusé (doublon dans ECF)',
    pg_temp.clo_lire('siege_a', format('select public.creer_centre(%L)::text', lower(v_nom))), 'ERREUR P0001 centre: Ce centre existe déjà.');
  perform pg_temp.attendre('noms', 'une insertion directe du même nom dans B (propriétaire) bute sur l''index lieux_organisme_nom (23505)',
    pg_temp.essai(format('insert into public.lieux (nom, organisme_id) values (%L, %s)', lower(v_nom), v_b)), 'ERREUR 23505');
  perform pg_temp.attendre('noms', 'le siège d''ECF crée un centre au nom d''un centre propre à B : accepté',
    left(pg_temp.clo_lire('siege_a', $q$select public.creer_centre('Preuve clo siège centre B')::text$q$), 3)
      || pg_temp.calcul($q$select string_agg(organisme_id::text, ',' order by organisme_id) from public.lieux where nom = 'Preuve clo siège centre B'$q$),
    'OK ' || v_a || ',' || v_b);

  -- Titre du réseau (niveau réseau) : un nom d'ECF créé par le siège de B, puis les doublons.
  v_titre := pg_temp.calcul(format($q$select t.nom from public.titres t where t.organisme_id = %s and t.niveau = 'reseau' and not t.fixe
      and not exists (select 1 from public.titres u where u.organisme_id = %s and lower(u.nom) = lower(t.nom))
      order by t.id limit 1$q$, v_a, v_b));
  perform pg_temp.informer('noms, titre', format('nom d''un titre réseau d''ECF repris par B : %s', coalesce(v_titre, 'aucun')));
  perform pg_temp.attendre('noms', 'le siège de B crée un titre réseau au nom d''un titre réseau d''ECF : accepté, dans B',
    left(pg_temp.clo_lire('siege_b', format('select public.creer_titre(%s, %L, null)::text', v_tb, v_titre)), 3)
      || pg_temp.calcul(format('select string_agg(organisme_id::text, '','' order by organisme_id) from public.titres where lieu_id is null and lower(nom) = lower(%L)', v_titre)),
    'OK ' || v_a || ',' || v_b);
  perform pg_temp.attendre('noms', 'le siège de B recrée ce titre en capitales : refusé (doublon dans B)',
    pg_temp.clo_lire('siege_b', format('select public.creer_titre(%s, %L, null)::text', v_tb, upper(v_titre))), 'ERREUR P0001 titres: Un titre de ce nom existe déjà ici.');
  perform pg_temp.attendre('noms', 'le siège d''ECF recrée ce titre en minuscules : refusé (doublon dans ECF)',
    pg_temp.clo_lire('siege_a', format('select public.creer_titre(%s, %L, null)::text',
      coalesce(pg_temp.calcul(format('select min(id)::text from public.titres where organisme_id = %s and niveau = ''reseau''', v_a)), 'null'), lower(v_titre))),
    'ERREUR P0001 titres: Un titre de ce nom existe déjà ici.');
  perform pg_temp.attendre('noms', 'le nom d''un titre fixe reste réservé dans toute la base (siège de B)',
    pg_temp.clo_lire('siege_b', format($q$select public.creer_titre(%s, 'formateur', null)::text$q$, v_tb)), 'ERREUR P0001 titres: Ce nom est réservé à un titre fixe.');
  -- Titre du réseau de niveau centre : lui aussi appartient à un organisme (vu dans les centres de B, pas dans ceux d'ECF).
  v_dir_fixe := coalesce(pg_temp.calcul('select id::text from public.titres where fixe and niveau = ''centre'''), 'null');
  v_tca := pg_temp.calcul(format($q$select t.nom from public.titres t where t.organisme_id = %s and t.niveau = 'centre' and t.lieu_id is null and not t.fixe
      and not exists (select 1 from public.titres u where u.organisme_id = %s and lower(u.nom) = lower(t.nom))
      order by t.id limit 1$q$, v_a, v_b));
  v := pg_temp.clo_lire('siege_b', format('select public.creer_titre(%s, %L, null)::text', v_dir_fixe, coalesce(v_tca, 'Preuve clo titre centre réseau B')));
  perform pg_temp.attendre('noms', 'le siège de B crée un titre du réseau de niveau centre au nom d''un titre d''ECF : accepté, dans B',
    left(v, 3) || pg_temp.calcul(format('select coalesce(organisme_id::text, ''nul'') from public.titres where id = %s', case when v ~ '^OK [0-9]+$' then substr(v, 4) else 'null' end)),
    'OK ' || v_b);
  perform pg_temp.attendre('noms', 'ce titre paraît dans un centre de B (direction de B), pas dans un centre d''ECF (direction d''ECF)',
    pg_temp.clo_lire('dir_b', format('select count(*)::text from public.titres_visibles(%s) where id = %s', v_lb, case when v ~ '^OK [0-9]+$' then substr(v, 4) else 'null' end))
      || ' / ' || pg_temp.clo_lire('dir_a', format('select count(*)::text from public.titres_visibles(%s) where id = %s', v_la, case when v ~ '^OK [0-9]+$' then substr(v, 4) else 'null' end)),
    'OK 1 / OK 0');
  perform pg_temp.attendre('noms', 'à la fin, aucun titre du réseau non fixe sans organisme (tous niveaux)',
    pg_temp.calcul('select count(*)::text from public.titres where lieu_id is null and not fixe and organisme_id is null'), '0');
end $cgno$;

do $clopreuve$
declare
  v_mode constant text :=
-- @@MODE@@
  ;
  v_debut constant timestamptz := clock_timestamp();
  v_en_ligne boolean;
  v_etat text; v_e1 text; v_e2a text; v_e2b text; v_e2c text; v_sab text;
  v_r text; v_r1 text; v_r2a text; v_r2b text; v_r2c text; v_rsab text;
  v_av_regles text; v_av_fonctions text; v_av_droits text;
  v_ap_regles text; v_ap_fonctions text; v_ap_droits text;
  v_habillage text; v_habillage_brut text; v_fondateurs integer;
  v_txt_r2c text; v_txt_r2b text; v_txt_r2a text; v_txt_r1 text;
  v_photo_avant text; v_photo_apres text;
begin
  perform set_config('lock_timeout', '3s', true);
  v_en_ligne := v_mode like 'cloisonnement-en-ligne%';

  -- 1. Avant les migrations : empreinte ; lignes d'avant (un siège et sa ligne de journal, pour que le remplissage se juge sur
  --    elles) ; ce que la migration doit reprendre (habillage du réseau, fondateurs).
  select e.regles, e.fonctions, e.droits into v_av_regles, v_av_fonctions, v_av_droits from pg_temp.empreinte() e;
  insert into public.user_profiles (email, role, is_admin) values ('preuve.clo.avant.siege@exemple.invalid', 'prof', false);
  insert into public.affectations (email, role) values ('preuve.clo.avant.siege@exemple.invalid', 'siege');
  drop table if exists pg_temp.clo_avant;
  create temp table clo_avant (tbl text, id bigint);
  insert into pg_temp.clo_avant
    select 'lieux', id from public.lieux
    union all select 'affectations', id from public.affectations where role = 'siege'
    union all select 'titres', id from public.titres where niveau = 'reseau' and not fixe
    union all select 'journal_droits', id from public.journal_droits
    union all select 'profs', id from public.profs
    union all select 'ressources', id from public.ressources
    union all select 'qcm_signalements', id from public.qcm_signalements;
  v_habillage_brut := (select s.value from public.settings s where s.promo_id is null and s.key = 'habillage_reseau' and s.value in ('ecsr', 'ecf'));
  v_habillage := coalesce(v_habillage_brut, 'ecsr');
  v_fondateurs := (select count(*) from public.user_profiles where is_founder);
  -- Les droits par défaut de Supabase (le propriétaire du schéma donne tout à anon, authenticated et service_role sur toute table,
  -- séquence et fonction neuves de public) n'existent pas sur la base locale : posés ici, dans la transaction annulée, pour que la
  -- migration doive les retirer elle-même. Sans effet en mode en ligne (les objets existent déjà).
  alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
  perform pg_temp.informer('droits par défaut de Supabase', 'simulés dans la transaction : alter default privileges pour postgres, schéma public, tables, séquences et fonctions à anon, authenticated, service_role');

  -- 2. Les migrations, dans l'ordre (neutralisées dans les modes sans elles), puis la règle relâchée du mode sabotage.
  v_etat := pg_temp.jouer('migration 1',
-- @@INJECTER supabase/migrations/20261128_cloisonnement_1_fondations.sql@@
  );
  v_e1 := v_etat;
  perform pg_temp.etape('migration 1', v_etat, v_mode);
  -- Photo du noyau avant l'étape 2a (ECF seul), comparée après toutes les migrations (groupe equivalence-ecf).
  v_photo_avant := pg_temp.photo_noyau();
  v_etat := pg_temp.jouer('migration 2a',
-- @@INJECTER supabase/migrations/20261128_cloisonnement_2a_noyau.sql@@
  );
  v_e2a := v_etat;
  perform pg_temp.etape('migration 2a', v_etat, v_mode);
  v_etat := pg_temp.jouer('migration 2b',
-- @@INJECTER supabase/migrations/20261128_cloisonnement_2b_siege_titres.sql@@
  );
  v_e2b := v_etat;
  perform pg_temp.etape('migration 2b', v_etat, v_mode);
  v_etat := pg_temp.jouer('migration 2c',
-- @@INJECTER supabase/migrations/20261128_cloisonnement_2c_donnees.sql@@
  );
  v_e2c := v_etat;
  perform pg_temp.etape('migration 2c', v_etat, v_mode);
  v_etat := pg_temp.jouer('sabotage',
-- @@INJECTER tests/sql/cloisonnement-sabotage.sql@@
  );
  v_sab := v_etat;
  perform pg_temp.etape('sabotage', v_etat, v_mode);

  -- 3. Un seul organisme : fondations posées par la migration, noyau égal à l'ancien, remplissage sans B.
  -- Étape 2b en place (organismes.habillage facultatif) : l'organisme 1 porte la clé globale telle quelle, nulle si elle n'était pas réglée.
  perform pg_temp.groupe_fondations_existant(case when pg_temp.calcul($q$select (not a.attnotnull)::text from pg_attribute a
      where a.attrelid = 'public.organismes'::regclass and a.attname = 'habillage'$q$) = 'true' then v_habillage_brut else v_habillage end, v_fondateurs);
  v_photo_apres := pg_temp.photo_noyau();
  perform pg_temp.groupe_equivalence_ecf(v_photo_avant, v_photo_apres, v_e2a);
  perform pg_temp.groupe_remplissage_seul();

  -- 4. L'organisme B et les personnages, puis les groupes qui les jouent.
  perform pg_temp.poser_cloisonnement();
  perform pg_temp.informer('objets posés', (select string_agg(cle || '=' || coalesce(valeur, 'nul'), ', ' order by cle) from pg_temp.clo_obj));
  perform pg_temp.groupe_fondations_personnages();
  perform pg_temp.groupe_support_journal();
  perform pg_temp.groupe_noyau();
  perform pg_temp.groupe_apercu(false);
  perform pg_temp.groupe_support();
  perform pg_temp.groupe_remplissage();
  perform pg_temp.groupe_siege();
  perform pg_temp.groupe_titres();
  perform pg_temp.groupe_noms();
  perform pg_temp.groupe_fondations_final();

  -- 5. Les retours, dans l'ordre inverse (sabotage, 2c, 2b, 2a, 1).
  v_r := pg_temp.jouer('retour du sabotage',
-- @@INJECTER tests/sql/cloisonnement-sabotage-retour.sql@@
  );
  v_rsab := v_r;
  perform pg_temp.etape('retour du sabotage', v_r, v_mode);
  -- Les textes des retours 2c, 2b, 2a et 1, lus dans l'ordre du jeu, puis joués ; un retour joué trop tôt (une étape plus tardive
  -- encore en place) est refusé par sa garde, sans rien changer (règle du contrôleur, 27/11).
  v_txt_r2c :=
-- @@INJECTER supabase/migrations/20261128_cloisonnement_2c_donnees_retour.sql@@
  ;
  v_txt_r2b :=
-- @@INJECTER supabase/migrations/20261128_cloisonnement_2b_siege_titres_retour.sql@@
  ;
  v_txt_r2a :=
-- @@INJECTER supabase/migrations/20261128_cloisonnement_2a_noyau_retour.sql@@
  ;
  v_txt_r1 :=
-- @@INJECTER supabase/migrations/20261128_cloisonnement_1_fondations_retour.sql@@
  ;
  if v_e2b = 'jouée' and v_txt_r2a <> 'select 1' then
    v_r := pg_temp.jouer('retour 2a joué trop tôt', v_txt_r2a);
    perform pg_temp.attendre('retour', 'le retour 2a joué avant celui de l''étape 2b (encore en place) est refusé par sa garde',
      left(v_r, 76), 'ERREUR P0001 cloisonnement_2a_retour : une étape plus tardive est en place (');
  end if;
  v_r := pg_temp.jouer('retour 2c', v_txt_r2c);
  v_r2c := v_r;
  perform pg_temp.etape('retour 2c', v_r, v_mode);
  -- Le retour 2b remet les unicités globales de noms : tant que deux organismes ont un centre du même nom, sa garde le refuse. Il ne
  -- se joue qu'avant la mise en service d'un autre organisme : ici, les noms des objets des autres organismes sont d'abord suffixés.
  if v_e2b = 'jouée' and v_txt_r2b <> 'select 1' then
    v_r := pg_temp.jouer('retour 2b joué avec des noms partagés', v_txt_r2b);
    perform pg_temp.attendre('retour', 'le retour 2b joué quand deux organismes ont un centre du même nom est refusé par sa garde',
      left(v_r, 84), 'ERREUR P0001 cloisonnement_2b_retour : deux centres portent le même nom (dans deux o');
    perform pg_temp.informer('avant le retour 2b', format('noms suffixés : %s centre(s), %s titre(s) du réseau d''un autre organisme qu''ECF',
      pg_temp.calcul($q$with m as (update public.lieux set nom = nom || ' (organisme ' || organisme_id || ')' where organisme_id <> 1 returning 1) select count(*)::text from m$q$),
      pg_temp.calcul($q$with m as (update public.titres set nom = nom || ' (organisme ' || organisme_id || ')' where organisme_id <> 1 returning 1) select count(*)::text from m$q$)));
  end if;
  v_r := pg_temp.jouer('retour 2b', v_txt_r2b);
  v_r2b := v_r;
  perform pg_temp.etape('retour 2b', v_r, v_mode);
  if v_e2a = 'jouée' and v_r2a is null and v_txt_r1 <> 'select 1' then
    v_r := pg_temp.jouer('retour 1 joué trop tôt', v_txt_r1);
    perform pg_temp.attendre('retour', 'le retour 1 joué avant celui de l''étape 2a (encore en place) est refusé par sa garde',
      left(v_r, 75), 'ERREUR P0001 cloisonnement_1_retour : une étape plus tardive est en place (');
  end if;
  v_r := pg_temp.jouer('retour 2a', v_txt_r2a);
  v_r2a := v_r;
  perform pg_temp.etape('retour 2a', v_r, v_mode);
  v_r := pg_temp.jouer('retour 1', v_txt_r1);
  v_r1 := v_r;
  perform pg_temp.etape('retour 1', v_r, v_mode);

  -- 6. Groupe retour : jugé seulement si l'étape 1 et son retour ont été joués (chaque étape injectée l'est avec son retour).
  select e.regles, e.fonctions, e.droits into v_ap_regles, v_ap_fonctions, v_ap_droits from pg_temp.empreinte() e;
  if v_en_ligne or v_e1 = 'neutralisée' or v_r1 = 'neutralisée' then
    perform pg_temp.informer('retours', format('non jugeables (migration 1 ou son retour non injectés) ; empreinte du moment : regles %s, fonctions %s, droits %s',
      v_ap_regles, v_ap_fonctions, v_ap_droits));
  else
    perform pg_temp.attendre('retour', 'après les retours : plus de table organismes ni acces_fondateur',
      pg_temp.calcul($q$select coalesce(to_regclass('public.organismes')::text, 'sans table') || '/' || coalesce(to_regclass('public.acces_fondateur')::text, 'sans table')$q$),
      'sans table/sans table');
    perform pg_temp.attendre('retour', 'après les retours : plus de colonne organisme_id sur les sept tables',
      pg_temp.calcul(format($q$select count(*)::text from pg_attribute a where a.attrelid = any (select to_regclass('public.' || t) from unnest(%L::text[]) t)
        and a.attname = 'organisme_id' and not a.attisdropped$q$, pg_temp.tables_organisme())), '0');
    perform pg_temp.attendre('retour', 'après les retours : les quinze fonctions de l''étape 1 ont disparu',
      pg_temp.calcul(format($q$select count(*)::text from pg_proc where pronamespace = 'public'::regnamespace and proname = any (%L::text[])$q$, pg_temp.fonctions_etape_1())), '0');
    perform pg_temp.attendre('retour', 'après les retours : plus de déclencheur organisme_par_defaut, journal_droits_organisme ni rattachement_fondateur, plus d''index lieux_organisme_nom',
      pg_temp.calcul($q$select (select count(*) from pg_trigger where tgname in ('organisme_par_defaut', 'journal_droits_organisme', 'rattachement_fondateur'))::text
        || '/' || coalesce(to_regclass('public.lieux_organisme_nom')::text, 'sans index')$q$), '0/sans index');
    perform pg_temp.attendre('retour', 'après les retours : empreinte regles identique à celle d''avant', v_ap_regles, v_av_regles);
    perform pg_temp.attendre('retour', 'après les retours : empreinte fonctions identique à celle d''avant', v_ap_fonctions, v_av_fonctions);
    perform pg_temp.attendre('retour', 'après les retours : empreinte droits identique à celle d''avant', v_ap_droits, v_av_droits);
  end if;
  perform pg_temp.informer('durée du bloc', to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0') || ' s');
  perform pg_temp.verdict_titres(v_mode, v_debut);
  raise exception 'la preuve doit finir par la levée du verdict';
end $clopreuve$;
