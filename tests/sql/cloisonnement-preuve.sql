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
  perform pg_temp.attendre('fondations', 'aucune fonction de l''étape 1 exécutable par anon',
    pg_temp.calcul(format($q$select count(*)::text from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.proname = any (%L::text[]) and has_function_privilege('anon', p.oid, 'execute')$q$, pg_temp.fonctions_etape_1())), '0');
  perform pg_temp.attendre('fondations', 'organismes et acces_fondateur : sécurité de ligne active, aucune écriture pour anon ni authenticated, acces_fondateur lisible par authenticated seul',
    pg_temp.calcul($q$select concat_ws('|',
        (select string_agg(c.relname || '=' || c.relrowsecurity, ',' order by c.relname) from pg_class c where c.oid in ('public.organismes'::regclass, 'public.acces_fondateur'::regclass)),
        (select count(*) from (values ('anon'), ('authenticated')) r(r) cross join (values ('public.organismes'), ('public.acces_fondateur')) t(t)
          cross join (values ('insert'), ('update'), ('delete'), ('truncate')) d(d) where has_table_privilege(r.r, t.t, d.d)),
        has_table_privilege('authenticated', 'public.acces_fondateur', 'select')::text, has_table_privilege('anon', 'public.acces_fondateur', 'select')::text)$q$),
    'acces_fondateur=true,organismes=true|0|true|false');
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
  r record; v text; v_s1 text; v_s2 text; v_s3 text; v_total text;
begin
  perform pg_temp.attendre('support-journal', 'hors support, mon_organisme() du fondateur ne porte aucune échéance',
    pg_temp.clo_lire('fond_a', 'select coalesce(support_jusqua::text, ''aucune'') from public.mon_organisme()'), 'OK aucune');
  -- Refus (22023) : motif court, blanc rembourré ou absent ; durée nulle, négative, absente ou de 3 h ; organisme du rattachement ou inconnu.
  for r in select * from (values
      ('motif de 5 caractères', v_b, '''court''', '''1 hour''::interval'),
      ('motif de 3 caractères entouré de blancs', v_b, '''      abc       ''', '''1 hour''::interval'),
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

  -- 2. Les migrations, dans l'ordre (neutralisées dans les modes sans elles), puis la règle relâchée du mode sabotage.
  v_etat := pg_temp.jouer('migration 1',
-- @@INJECTER supabase/migrations/20261128_cloisonnement_1_fondations.sql@@
  );
  v_e1 := v_etat;
  perform pg_temp.etape('migration 1', v_etat, v_mode);
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

  -- 3. Un seul organisme : fondations posées par la migration, remplissage sans B.
  perform pg_temp.groupe_fondations_existant(v_habillage, v_fondateurs);
  perform pg_temp.groupe_remplissage_seul();

  -- 4. L'organisme B et les personnages, puis les groupes qui les jouent.
  perform pg_temp.poser_cloisonnement();
  perform pg_temp.informer('objets posés', (select string_agg(cle || '=' || coalesce(valeur, 'nul'), ', ' order by cle) from pg_temp.clo_obj));
  perform pg_temp.groupe_fondations_personnages();
  perform pg_temp.groupe_support_journal();
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
