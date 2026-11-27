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
--   retour           les retours défont tout, dans l'ordre inverse (2c, 2b, 2a, 1) : l'empreinte (règles, fonctions, droits)
--                    égale celle d'avant ; tables, colonnes, fonctions et déclencheurs du chantier disparus.
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
  perform pg_temp.attendre('fondations', 'organisme 1 : ECF BOUSCAREN, rédacteur, habillage égal à l''ancien réglage du réseau',
    pg_temp.calcul($q$select concat_ws('|', id, nom, redacteur::text, habillage) from public.organismes where id = 1$q$),
    '1|ECF BOUSCAREN|true|' || p_habillage);
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
  perform pg_temp.attendre('fondations', 'les titres fixes et les titres de promo ou de centre restent sans organisme',
    pg_temp.calcul($q$select count(*)::text from public.titres where (fixe or niveau <> 'reseau') and organisme_id is not null$q$), '0');
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
  v_habillage text; v_fondateurs integer;
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
  v_habillage := coalesce((select s.value from public.settings s where s.promo_id is null and s.key = 'habillage_reseau' and s.value in ('ecsr', 'ecf')), 'ecsr');
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
  perform pg_temp.groupe_fondations_existant(v_habillage, v_fondateurs);
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
  perform pg_temp.groupe_fondations_final();

  -- 5. Les retours, dans l'ordre inverse (sabotage, 2c, 2b, 2a, 1).
  v_r := pg_temp.jouer('retour du sabotage',
-- @@INJECTER tests/sql/cloisonnement-sabotage-retour.sql@@
  );
  v_rsab := v_r;
  perform pg_temp.etape('retour du sabotage', v_r, v_mode);
  v_r := pg_temp.jouer('retour 2c',
-- @@INJECTER supabase/migrations/20261128_cloisonnement_2c_donnees_retour.sql@@
  );
  v_r2c := v_r;
  perform pg_temp.etape('retour 2c', v_r, v_mode);
  v_r := pg_temp.jouer('retour 2b',
-- @@INJECTER supabase/migrations/20261128_cloisonnement_2b_siege_titres_retour.sql@@
  );
  v_r2b := v_r;
  perform pg_temp.etape('retour 2b', v_r, v_mode);
  v_r := pg_temp.jouer('retour 2a',
-- @@INJECTER supabase/migrations/20261128_cloisonnement_2a_noyau_retour.sql@@
  );
  v_r2a := v_r;
  perform pg_temp.etape('retour 2a', v_r, v_mode);
  v_r := pg_temp.jouer('retour 1',
-- @@INJECTER supabase/migrations/20261128_cloisonnement_1_fondations_retour.sql@@
  );
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
