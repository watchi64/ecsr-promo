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
--   personnel        (étape 2c, Review Focus 5, règles 2 et 3) inviter dans B le personnel d'ECF : refusé mot pour mot (« Cette adresse
--                    ne peut pas être invitée ici. ») par inviter_compte (formateur, direction, siège), donner_titre et le déclencheur,
--                    rien d'écrit ; un ancien stagiaire d'ECF invité dans B comme formateur : accepté (fiche profs d'ECF non reliée,
--                    inviteur d'ECF remplacé) ; un ancien stagiaire d'ECF (fiche gardée) devenu siège ou formateur de B : sans en-tête,
--                    organisme courant B, est_siege() vrai, mon_organisme() = B ; sous l'en-tête de sa promo d'ECF, rien du personnel
--                    d'ECF ; aucun personnage ne lit un profil du personnel de l'autre organisme.
--   annuaire         (étape 2c) partage d'une fiche avec un centre de l'autre organisme, fiche profs de l'autre organisme : refusés ;
--                    le fondateur hors support ne partage pas une fiche de B ; annuaire_centre, ma_fiche_contact,
--                    _contact_relais_possibles, _contact_fiche_dans : rien de l'autre organisme.
--   planning         (étape 2c) fiches profs lues et écrites dans l'organisme (organisme_id d'un autre organisme écrit en clair refusé) ;
--                    un même nom dans deux organismes, un doublon dans un organisme refusé ; règle 4 (ECF sans en-tête crée encore).
--   contenus         (étape 2c) B lit cours et QCM publiés, n'écrit ni cours, ni question, ni option, ni image, ni thème, ni
--                    compétence, ni QCM ; ECF (rédacteur) les écrit ; gestes des contenus et case_reseau(cours) ; Ressources : commune
--                    (lue par tous, écrite par le rédacteur), d'ECF, de B ; règle 4.
--   signalements     (étape 2c) un signalement de B lu et traité par l'équipe de B, jamais par le rédacteur d'ECF ; le fondateur
--                    hors support ne le lit pas, en support oui ; instructions et brouillons de l'IA au rédacteur ; règle 4.
--   qualite          (étape 2c, règle 1 : bornage complet) registre, ouvertures et résultats des questionnaires, etat_conservation,
--                    etat_conservation_centre, effacer_*, autonomie_opposer, journal des effacements, conditions, profils : le
--                    fondateur hors support ne lit ni ne modifie rien de B ; en support sur B, ceux de B ouverts, ceux d'ECF refusés.
--   matrice          (étape 2c, § 5.6) chaque personnage des deux organismes (règle 3 comprise), chaque table de pg_tables (schéma
--                    public) classée par une expression de l'organisme d'une ligne ou mise en exception justifiée (une table non
--                    classée rougit), chaque fonction de lecture de l'inventaire : aucune ligne de l'autre organisme lue, aucune
--                    modification ni suppression (sans RETURNING) d'une ligne de l'autre organisme.
--   retour           les retours défont tout, dans l'ordre inverse (2c, 2b, 2a, 1) : l'empreinte (règles, fonctions, droits)
--                    égale celle d'avant ; tables, colonnes, fonctions et déclencheurs du chantier disparus.
--                    Un retour joué trop tôt (retour 2b avec la 2c en place, retour 2a avec la 2b en place, retour 1 avec la 2a en
--                    place) est refusé par sa garde.
--   sabotage         (mode cloisonnement-sabotage) une règle relâchée après la 2c (profs lisible par tous) : ROUGE attendu sur les
--                    groupes planning et matrice seulement.
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

-- Étape 2c : aides des groupes personnel, annuaire, planning, contenus, signalements, qualite et matrice.

-- L'organisme d'une adresse du personnel, calculé par la preuve elle-même (sans les fonctions de l'étape 2c) : son affectation siège,
-- sinon celui de ses affectations de direction et de formateur s'il n'y en a qu'un ; nul sinon (ou si les objets manquent).
create or replace function pg_temp.clo_org_personnel(p_email text)
returns integer language plpgsql as $cop$
declare v integer;
begin
  select coalesce(
    (select af.organisme_id from public.affectations af
      where lower(af.email) = lower(p_email) and af.role = 'siege' and af.organisme_id is not null order by af.id limit 1),
    (select min(x.o) from (select coalesce(public.organisme_de_lieu(af.lieu_id), public.organisme_de_promo(af.promo_id)) as o
                             from public.affectations af
                            where lower(af.email) = lower(p_email) and af.role in ('direction', 'formateur')) x
      where x.o is not null having count(distinct x.o) = 1)) into v;
  return v;
exception when others then
  return null;
end $cop$;

-- L'organisme d'un compte (spec § 5.2), calculé par la preuve : son personnel, sinon la promo de sa fiche de stagiaire la plus
-- récente, sinon le personnel de qui l'a invité ; nul sinon.
create or replace function pg_temp.clo_org_compte(p_email text)
returns integer language plpgsql as $coc$
declare v integer;
begin
  select coalesce(pg_temp.clo_org_personnel(p_email),
    (select public.organisme_de_promo(s.promo_id) from public.user_profiles up join public.stagiaires s on s.id = up.stagiaire_id
      where lower(up.email) = lower(p_email) order by s.id desc limit 1),
    (select pg_temp.clo_org_personnel(up.invited_by_email) from public.user_profiles up
      where lower(up.email) = lower(p_email) and up.invited_by_email is not null limit 1)) into v;
  return v;
exception when others then
  return null;
end $coc$;

create or replace function pg_temp.clo_org_stagiaire(p_id bigint)
returns integer language plpgsql as $cos$
begin
  return (select public.organisme_de_promo(s.promo_id) from public.stagiaires s where s.id = p_id);
exception when others then
  return null;
end $cos$;

create or replace function pg_temp.clo_org_demande(p_id bigint)
returns integer language plpgsql as $cod2$
begin
  return (select coalesce(public.organisme_de_lieu(d.lieu_id), public.organisme_de_promo(d.promo_id)) from public.demandes d where d.id = p_id);
exception when others then
  return null;
end $cod2$;

-- L'organisme d'une cible du journal des effacements (« promo n », « stagiaire n », « lieu n[, année a] »).
create or replace function pg_temp.clo_org_cible(p_cible text)
returns integer language plpgsql as $coci$
begin
  if p_cible ~ '^promo [0-9]{1,9}$' then return public.organisme_de_promo(substr(p_cible, 7)::integer); end if;
  if p_cible ~ '^stagiaire [0-9]{1,9}$' then return pg_temp.clo_org_stagiaire(substr(p_cible, 11)::bigint); end if;
  if p_cible ~ '^lieu [0-9]{1,9}([^0-9]|$)' then return public.organisme_de_lieu(substring(p_cible from '^lieu ([0-9]{1,9})')::integer); end if;
  return null;
exception when others then
  return null;
end $coci$;

-- L'organisme d'une entrée du registre qualité : son centre, sinon sa promo, sinon celui qu'elle porte (colonne de l'étape 2c, lue
-- seulement si elle existe).
create or replace function pg_temp.clo_org_registre(p_id bigint)
returns integer language plpgsql as $cor$
declare v integer;
begin
  begin
    execute 'select coalesce(public.organisme_de_lieu(lieu_id), public.organisme_de_promo(promo_id), organisme_id) from public.registre_qualite where id = $1'
      into v using p_id;
  exception when undefined_column then
    execute 'select coalesce(public.organisme_de_lieu(lieu_id), public.organisme_de_promo(promo_id)) from public.registre_qualite where id = $1'
      into v using p_id;
  end;
  return v;
exception when others then
  return null;
end $cor$;

-- L'organisme d'une ligne du journal des effacements : sa cible, sinon celui qu'elle porte (colonne de l'étape 2c, si elle existe).
create or replace function pg_temp.clo_org_effacement(p_id bigint)
returns integer language plpgsql as $coe$
declare v integer;
begin
  begin
    execute 'select coalesce(pg_temp.clo_org_cible(cible), organisme_id) from public.effacements_journal where id = $1' into v using p_id;
  exception when undefined_column then
    execute 'select pg_temp.clo_org_cible(cible) from public.effacements_journal where id = $1' into v using p_id;
  end;
  return v;
exception when others then
  return null;
end $coe$;

-- L'organisme d'une fiche d'annuaire : son centre, sinon son compte.
create or replace function pg_temp.clo_org_contact(p_id bigint)
returns integer language plpgsql as $coct$
begin
  return (select coalesce(public.organisme_de_lieu(c.lieu_id), pg_temp.clo_org_compte(c.compte_email)) from public.contacts c where c.id = p_id);
exception when others then
  return null;
end $coct$;

-- Une écriture jouée par un personnage (jeton, en-tête de sa promo), toujours annulée (sous-transaction défaite) : « OK <lignes> » ou
-- « ERREUR <état> <message> ». Sert aux écritures de la matrice : une écriture qui passerait ne change rien à la suite.
create or replace function pg_temp.clo_ecrire_annule(p_nom text, p_sql text)
returns text language plpgsql as $cea$
declare n bigint; r text; v_email text; v_promo text;
begin
  select p.email, p.promo into v_email, v_promo from pg_temp.clo_perso p where p.nom = p_nom;
  begin
    perform pg_temp.incarner(v_email, v_promo, null);
    execute p_sql;
    get diagnostics n = row_count;
    raise exception using errcode = 'P0001', message = 'clo annulé ' || n;
  exception when others then
    r := case when sqlstate = 'P0001' and sqlerrm like 'clo annulé %' then 'OK ' || substr(sqlerrm, 12)
              else 'ERREUR ' || sqlstate || ' ' || sqlerrm end;
  end;
  perform pg_temp.proprio();
  return r;
end $cea$;

-- Un personnage de plus (les groupes de l'étape 2c en ajoutent : anciens stagiaires d'ECF devenus personnel de B, personnages d'ECF
-- sans en-tête).
create or replace function pg_temp.clo_ajouter_perso(p_nom text, p_email text, p_org text, p_promo text, p_role text)
returns void language sql as $cap$
  insert into pg_temp.clo_perso (nom, email, org, promo, role) values (p_nom, p_email, p_org, p_promo, p_role)
  on conflict (nom) do update set email = excluded.email, org = excluded.org, promo = excluded.promo, role = excluded.role;
$cap$;

-- Les lignes d'une table d'un organisme, vues par un personnage sous un en-tête x-promo-id choisi (nul : sans en-tête) : « n » (nombre
-- de lignes lues dont l'organisme est p_org, selon l'expression de la matrice), ou « ERREUR ... ». Une lecture refusée (42501) compte 0.
-- p_sauf : condition (alias t) des lignes qui ne comptent pas (la promo de stagiaire d'un ancien stagiaire de l'autre organisme).
create or replace function pg_temp.clo_compter_entete(p_nom text, p_entete text, p_table text, p_org text, p_sauf text default null)
returns text language plpgsql as $ccp$
declare v text; v_expr text; n bigint;
begin
  select e.expr into v_expr from pg_temp.clo_mat_tables e where e.tbl = p_table;
  v := pg_temp.clo_lire_entete(p_nom, p_entete, format('select coalesce(array_agg(t.ctid::text), ''{}'')::text from public.%I t', p_table));
  if v like 'ERREUR 42501%' then return '0'; end if;
  if v not like 'OK %' then return v; end if;
  begin
    execute format('select count(*) from public.%I t where t.ctid = any (%L::tid[]) and (%s) = %s and not coalesce(%s, false)',
      p_table, substr(v, 4), v_expr, coalesce(p_org, 'null'), coalesce(p_sauf, 'false')) into n;
  exception when others then
    return 'incalculable (' || sqlstate || ')';
  end;
  return n::text;
end $ccp$;

-- La même, sous l'en-tête de la promo du personnage (clo_perso.promo).
create or replace function pg_temp.clo_compter(p_nom text, p_table text, p_org text, p_sauf text default null)
returns text language sql as $ccq$
  select pg_temp.clo_compter_entete(p_nom, (select p.promo from pg_temp.clo_perso p where p.nom = p_nom), p_table, p_org, p_sauf);
$ccq$;

-- Une lecture jouée par un personnage (jeton, rôle authenticated) sous un en-tête x-promo-id choisi (nul : sans en-tête).
create or replace function pg_temp.clo_lire_entete(p_nom text, p_entete text, p_sql text)
returns text language plpgsql as $cle$
declare v text; r text;
begin
  perform pg_temp.incarner((select p.email from pg_temp.clo_perso p where p.nom = p_nom), p_entete, null);
  begin
    execute p_sql into v;
    r := rtrim('OK ' || coalesce(v, 'nul'));
  exception when others then
    r := 'ERREUR ' || sqlstate || ' ' || sqlerrm;
  end;
  perform pg_temp.proprio();
  return r;
end $cle$;

-- Le classement des tables de public pour la matrice : l'expression de l'organisme d'une ligne (alias t), ou une exception justifiée.
-- Une table de public absente des deux listes fait rougir la preuve (groupe matrice).
create or replace function pg_temp.clo_mat_classement()
returns void language plpgsql as $cmc$
begin
  drop table if exists pg_temp.clo_mat_tables;
  create temp table clo_mat_tables (tbl text primary key, expr text not null);
  insert into pg_temp.clo_mat_tables values
    ('absences_annoncees', 'public.organisme_de_promo(t.promo_id)'),
    ('affectations', 'coalesce(t.organisme_id, public.organisme_de_lieu(t.lieu_id), public.organisme_de_promo(t.promo_id))'),
    ('agenda_events', 'public.organisme_de_promo(t.promo_id)'),
    ('auto_ecoles', 'public.organisme_de_lieu(t.lieu_id)'),
    ('autonomie_oppositions', 'pg_temp.clo_org_stagiaire(t.stagiaire_id)'),
    ('autonomie_temps', 'public.organisme_de_promo(t.promo_id)'),
    ('benevole_suivi', 'public.organisme_de_lieu(t.lieu_id)'),
    ('benevoles', 'public.organisme_de_lieu(t.lieu_id)'),
    ('conditions_acceptations', 'pg_temp.clo_org_compte(t.email)'),
    ('contact_envois', 'pg_temp.clo_org_demande(t.demande_id)'),
    ('contact_financements', 'public.organisme_de_lieu(t.lieu_id)'),
    ('contact_jetons', 'pg_temp.clo_org_demande(t.demande_id)'),
    ('contact_regles', 'public.organisme_de_lieu(t.lieu_id)'),
    ('contact_reponses', 'public.organisme_de_lieu(t.lieu_id)'),
    ('contacts', 'coalesce(public.organisme_de_lieu(t.lieu_id), pg_temp.clo_org_compte(t.compte_email))'),
    ('cours_lectures', 'public.organisme_de_promo(t.promo_id)'),
    ('demande_destinataires', 'pg_temp.clo_org_demande(t.demande_id)'),
    ('demande_messages', 'pg_temp.clo_org_demande(t.demande_id)'),
    ('demandes', 'coalesce(public.organisme_de_lieu(t.lieu_id), public.organisme_de_promo(t.promo_id))'),
    ('dp_dossiers', 'public.organisme_de_promo(t.promo_id)'),
    ('effacements_journal', 'pg_temp.clo_org_effacement(t.id)'),
    ('emargement_formateurs', 'public.organisme_de_promo(t.promo_id)'),
    ('emargement_lignes', 'public.organisme_de_promo(t.promo_id)'),
    ('emargement_seances', 'public.organisme_de_promo(t.promo_id)'),
    ('epcf_evaluations', 'public.organisme_de_promo(t.promo_id)'),
    ('epcf_livrets', 'public.organisme_de_promo(t.promo_id)'),
    ('evaluations', 'public.organisme_de_promo(t.promo_id)'),
    ('evaluations_audit', 'public.organisme_de_promo(t.promo_id)'),
    ('journal_droits', 't.organisme_id'),
    ('jury_resultats', 'public.organisme_de_promo(t.promo_id)'),
    ('lieux', 't.organisme_id'),
    ('organismes', 't.id'),
    ('passages', 'public.organisme_de_promo(t.promo_id)'),
    ('passages_audit', 'public.organisme_de_promo(t.promo_id)'),
    ('planning_entries', 'public.organisme_de_promo(t.promo_id)'),
    ('planning_half_meta', 'public.organisme_de_promo(t.promo_id)'),
    ('planning_jours_off', 'public.organisme_de_promo(t.promo_id)'),
    ('profs', 't.organisme_id'),
    ('promos', 'public.organisme_de_promo(t.id)'),
    ('qcm_attempts', 'public.organisme_de_promo(t.promo_id)'),
    ('qcm_examens', 'public.organisme_de_promo(t.promo_id)'),
    ('qcm_signalements', 't.organisme_id'),
    ('questionnaire_clotures', 'public.organisme_de_lieu(t.lieu_id)'),
    ('questionnaire_ouvertures', 'coalesce(public.organisme_de_lieu(t.lieu_id), public.organisme_de_promo(t.promo_id))'),
    ('questionnaire_participations', 'coalesce(public.organisme_de_lieu(t.lieu_id), public.organisme_de_promo(t.promo_id))'),
    ('questionnaire_reponses', 'coalesce(public.organisme_de_lieu(t.lieu_id), public.organisme_de_promo(t.promo_id))'),
    ('questionnaire_resultats_figes', 'coalesce(public.organisme_de_lieu(t.lieu_id), public.organisme_de_promo(t.promo_id))'),
    ('registre_qualite', 'pg_temp.clo_org_registre(t.id)'),
    ('ressources', 't.organisme_id'),
    ('settings', 'public.organisme_de_promo(t.promo_id)'),
    ('stagiaires', 'public.organisme_de_promo(t.promo_id)'),
    ('stagiaires_prive', 'pg_temp.clo_org_stagiaire(t.stagiaire_id)'),
    ('themes_progression', 'public.organisme_de_promo(t.promo_id)'),
    ('titres', 'coalesce(t.organisme_id, public.organisme_de_lieu(t.lieu_id))'),
    ('user_profiles', 'pg_temp.clo_org_compte(t.email)');
  drop table if exists pg_temp.clo_mat_exceptions;
  create temp table clo_mat_exceptions (tbl text primary key, raison text not null);
  insert into pg_temp.clo_mat_exceptions values
    ('acces_fondateur', 'journal du fondateur : lu par lui (spec § 5.1) et par le siège de l''organisme de la ligne (groupe support-journal)'),
    ('chatbot_usage', 'compteur de l''assistant, lu par son seul titulaire (user_id = auth.uid()) : aucune donnée d''organisme'),
    ('qcm_ia_usage', 'compteur de l''IA des QCM, lu par son seul titulaire (user_id = auth.uid()) : aucune donnée d''organisme'),
    ('competences', 'contenu commun (spec § 2) : lu par tous, écrit par le rédacteur (groupe contenus)'),
    ('cours', 'contenu commun : publié lu par tous, écrit par le rédacteur et le fondateur (groupe contenus)'),
    ('cours_versions', 'contenu commun : versions des cours, lues et écrites par le rédacteur et le fondateur (groupe contenus)'),
    ('cours_chunks', 'contenu commun : morceaux des cours pour l''assistant, aucune règle (service seulement)'),
    ('qcm', 'contenu commun : lu par tous, écrit par le rédacteur (groupe contenus)'),
    ('qcm_questions', 'contenu commun : lu par tous, écrit par le rédacteur (groupe contenus)'),
    ('qcm_options', 'contenu commun : lu par tous, écrit par le rédacteur (groupe contenus)'),
    ('themes', 'contenu commun : lu par tous, écrit par le rédacteur (groupe contenus)'),
    ('qcm_ia_brouillons', 'contenu commun réservé au rédacteur (spec § 5.7 ; groupe signalements) : brouillons de questions, sans personne'),
    ('qcm_signalement_instruction', 'contenu commun réservé au rédacteur (spec § 5.7 ; groupe signalements) : verdict sur la question, sans personne'),
    ('questionnaire_questions', 'questions des questionnaires Qualiopi, communes à la plateforme : aucune réponse, aucune promo'),
    ('signalements_app', '« Signaler un problème » : adressé au fondateur par nature, seule exception globale (spec § 2)'),
    ('signalements_app_captures', 'captures des « Signaler un problème » : même exception que signalements_app');
end $cmc$;

-- Groupe personnel (étape 2c, Review Focus 5) : un membre du personnel appartient à un seul organisme ; un ancien stagiaire d'ECF peut
-- devenir le personnel de B ; personne ne lit le personnel de l'autre organisme.
create or replace function pg_temp.groupe_personnel()
returns void language plpgsql as $cgpe$
declare
  v_a text := pg_temp.clo_n('org_a'); v_b text := pg_temp.clo_n('org_b');
  v_pa text := pg_temp.clo_n('promo_a'); v_pb text := pg_temp.clo_n('promo_b');
  v_la text := pg_temp.clo_n('lieu_a'); v_lb text := pg_temp.clo_n('lieu_b');
  v_tb text := pg_temp.clo_n('titre_b');
  v_prof_a text; v_dir_b text := (select email from pg_temp.clo_perso where nom = 'dir_b'); v_form_a text := (select email from pg_temp.clo_perso where nom = 'form_a');
  v_s1 integer; v_s2 integer; r record; v text;
  c_refus constant text := 'ERREUR 23514 Cette adresse ne peut pas être invitée ici.';
begin
  v_prof_a := pg_temp.calcul(format($q$select min(pf.id)::text from public.profs pf where pf.organisme_id = %s
      and not exists (select 1 from public.user_profiles u where u.prof_id = pf.id)$q$, v_a));
  -- Inviter dans B une adresse du personnel d'ECF : refusé, par chaque chemin, avant toute écriture.
  perform pg_temp.attendre('personnel', 'la direction de B invite le formateur d''ECF comme formateur de sa promo : refus mot pour mot, rien d''écrit (affectations de l''adresse, profil)',
    pg_temp.clo_lire('dir_b', format('select public.inviter_compte(%L, ''formateur'')::text', v_form_a))
      || ' ; ' || pg_temp.calcul(format('select count(*)::text || ''/'' || (select concat_ws('':'', role, is_admin, coalesce(prof_id::text, ''nul''), coalesce(invited_by_email, ''nul'')) from public.user_profiles where email = %L) from public.affectations where lower(email) = %L', v_form_a, v_form_a)),
    c_refus || ' ; 1/prof:t:nul:nul');
  perform pg_temp.attendre('personnel', 'le siège de B invite la direction d''ECF à la direction d''un centre de B : refus mot pour mot, rien d''écrit',
    pg_temp.clo_lire('siege_b', format('select public.inviter_compte(%L, ''direction'', null, null, %s)::text', (select email from pg_temp.clo_perso where nom = 'dir_a'), v_lb))
      || ' ; ' || pg_temp.calcul(format('select count(*)::text from public.affectations where lower(email) = %L and lieu_id = %s', (select email from pg_temp.clo_perso where nom = 'dir_a'), v_lb)),
    c_refus || ' ; 0');
  perform pg_temp.attendre('personnel', 'le fondateur en support sur B invite le siège d''ECF comme siège de B : refus mot pour mot, rien d''écrit',
    left(pg_temp.clo_lire('fond_a', format($q$select (public.ouvrir_acces_support(%s, 'Support de la preuve du personnel', '1 hour')).organisme_id::text$q$, v_b)), 3)
      || pg_temp.clo_lire('fond_a', format('select public.inviter_compte(%L, ''siege'')::text', (select email from pg_temp.clo_perso where nom = 'siege_a')))
      || ' ; ' || pg_temp.calcul(format('select count(*)::text from public.affectations where lower(email) = %L and organisme_id = %s', (select email from pg_temp.clo_perso where nom = 'siege_a'), v_b))
      || ' ; ' || pg_temp.clo_lire('fond_a', 'select ''fermé'' from public.fermer_acces_support() f'),
    'OK ' || c_refus || ' ; 0 ; OK fermé');
  perform pg_temp.attendre('personnel', 'le siège de B donne son titre réseau au siège d''ECF : refus mot pour mot (hier : succès sans écriture), rien d''écrit',
    pg_temp.clo_lire('siege_b', format('select public.donner_titre(%L, %s, null, null, null)::text', (select email from pg_temp.clo_perso where nom = 'siege_a'), v_tb))
      || ' ; ' || pg_temp.calcul(format('select count(*)::text from public.affectations where lower(email) = %L and organisme_id = %s', (select email from pg_temp.clo_perso where nom = 'siege_a'), v_b)),
    c_refus || ' ; 0');
  perform pg_temp.attendre('personnel', 'déclencheur : une affectation de formateur sur la promo de B pour le formateur d''ECF, écrite en propriétaire, est refusée mot pour mot (23514)',
    pg_temp.clo_ecrire(null, format('insert into public.affectations (email, role, promo_id) values (%L, ''formateur'', %s)', v_form_a, v_pb)),
    c_refus);
  insert into public.user_profiles (email, role, is_admin) values ('preuve.clo.defense@exemple.invalid', 'prof', false);
  perform pg_temp.attendre('personnel', '_affectations_titre (défense) : une affectation siège sur ECF portant le titre réseau de B est refusée (23514)',
    pg_temp.clo_ecrire(null, format('insert into public.affectations (email, role, organisme_id, titre_id) values (''preuve.clo.defense@exemple.invalid'', ''siege'', %s, %s)', v_a, v_tb)),
    'ERREUR 23514 titres: Ce titre appartient à un autre organisme.');

  -- Un ancien stagiaire d'ECF (compte sans fiche, invité par le formateur d'ECF) invité dans B comme formateur : accepté. La fiche
  -- profs d'ECF proposée n'est pas reliée ; l'adresse de qui l'avait invité dans ECF est remplacée par celle de la direction de B.
  insert into public.user_profiles (email, role, is_admin, invited_by_email) values ('preuve.clo.ancien.a@exemple.invalid', 'stagiaire', false, v_form_a);
  v := pg_temp.clo_lire('dir_b', format('select (public.inviter_compte(''preuve.clo.ancien.a@exemple.invalid'', ''formateur'', null, %s)) ->> ''transforme''', coalesce(v_prof_a, 'null')));
  perform pg_temp.attendre('personnel', 'la direction de B invite comme formateur un ancien stagiaire d''ECF (sans fiche) : accepté, le compte devient du personnel de B (affectation sur la promo de B)',
    v || ' ; ' || pg_temp.calcul(format($q$select string_agg(promo_id::text, ',') from public.affectations where email = 'preuve.clo.ancien.a@exemple.invalid'$q$)),
    'OK true ; ' || v_pb);
  perform pg_temp.attendre('personnel', 'cet ancien stagiaire : profil formateur, la fiche profs d''ECF proposée non reliée (elle reste libre), inviteur = la direction de B',
    pg_temp.calcul(format($q$select concat_ws('|', role, is_admin, coalesce(prof_id::text, 'nul'), invited_by_email = %L,
        (select count(*) from public.user_profiles u where u.prof_id = %s)) from public.user_profiles where email = 'preuve.clo.ancien.a@exemple.invalid'$q$, v_dir_b, coalesce(v_prof_a, 'null'))),
    'prof|t|nul|t|0');
  perform pg_temp.clo_ajouter_perso('ex_form_b', 'preuve.clo.ancien.a@exemple.invalid', 'B', v_pb, 'formateur');

  -- Règle 3 du contrôleur : un ancien stagiaire d'ECF (sa fiche reste dans la promo d'ECF) devenu siège de B, puis un autre devenu
  -- formateur de B (affectations posées en propriétaire, la fiche de stagiaire ne compte pas pour le personnel).
  insert into public.stagiaires (prenom, nom, ordre, promo_id) values ('Preuve clo ex siège', 'PREUVE', 992, 1) returning id into v_s1;
  insert into public.stagiaires (prenom, nom, ordre, promo_id) values ('Preuve clo ex formateur', 'PREUVE', 993, 1) returning id into v_s2;
  insert into public.user_profiles (email, role, is_admin, stagiaire_id) values
    ('preuve.clo.ex.siege.b@exemple.invalid', 'stagiaire', false, v_s1), ('preuve.clo.ex.form.b@exemple.invalid', 'stagiaire', false, v_s2);
  perform pg_temp.attendre('personnel', 'un ancien stagiaire d''ECF (fiche dans la promo d''ECF) devient siège de B, puis un autre formateur de B : acceptés (la fiche de stagiaire n''est pas une affectation)',
    pg_temp.clo_ecrire(null, format($q$insert into public.affectations (email, role, organisme_id) values ('preuve.clo.ex.siege.b@exemple.invalid', 'siege', %s)$q$, v_b))
      || ' ; ' || pg_temp.clo_ecrire(null, format($q$insert into public.affectations (email, role, promo_id) values ('preuve.clo.ex.form.b@exemple.invalid', 'formateur', %s)$q$, v_pb)),
    'OK 1 ; OK 1');
  perform pg_temp.clo_ajouter_perso('ex_siege_b', 'preuve.clo.ex.siege.b@exemple.invalid', 'B', null, 'siege');
  perform pg_temp.clo_ajouter_perso('ex_form_b2', 'preuve.clo.ex.form.b@exemple.invalid', 'B', null, 'formateur');
  perform pg_temp.attendre('personnel', 'règle 3 : l''ancien stagiaire d''ECF devenu siège de B, sans en-tête : organisme courant B, est_siege() vrai, mon_organisme() = B, aucune promo, est_siege_de(ECF) faux',
    pg_temp.clo_lire('ex_siege_b', format($q$select concat_ws('|', public.organisme_courant(), public.est_siege(), (select m.id from public.mon_organisme() m),
        coalesce(public.promo_courante()::text, 'nul'), public.est_siege_de(%s))$q$, v_a), true),
    format('OK %s|t|%s|nul|f', v_b, v_b));
  perform pg_temp.attendre('personnel', 'règle 3 : l''ancien stagiaire d''ECF devenu formateur de B, sans en-tête : organisme courant B, promo courante et promo par défaut = la promo de B, mon_organisme() = B',
    pg_temp.clo_lire('ex_form_b2', 'select concat_ws(''|'', public.organisme_courant(), public.promo_courante(), public.promo_par_defaut(), (select m.id from public.mon_organisme() m))', true),
    format('OK %s|%s|%s|%s', v_b, v_pb, v_pb, v_b));
  -- Sous l'en-tête de sa propre promo de stagiaire d'ECF : ses données de stagiaire seulement, rien du personnel d'ECF.
  for r in select * from (values ('ex_siege_b', v_s1), ('ex_form_b2', v_s2)) x(nom, fiche) loop
    perform pg_temp.attendre('personnel', format('règle 3 : %s sous l''en-tête de sa promo de stagiaire d''ECF : sa fiche (my_stagiaire_id), organisme courant ECF, aucun geste ni aucune case de personnel sur ECF', r.nom),
      pg_temp.clo_jouer(r.nom, v_pa, null, format($q$select concat_ws('|', public.my_stagiaire_id(), public.organisme_courant(), public.est_siege(), public.est_formateur(%1$s),
          public.geste_promo(%1$s, 'stagiaires.lire'), public.geste_promo(%1$s, 'notes.lire'), public.geste_promo(%1$s, 'planning.modifier'), public.case_promo(%1$s, 'notes'),
          public.case_reseau('directions'), public.geste_reseau('directions.lire'))$q$, v_pa)),
      format('OK %s|%s|f|f|f|f|f|0|0|f', r.fiche, v_a));
    perform pg_temp.attendre('personnel', format('règle 3 : %s sous l''en-tête de sa promo de stagiaire d''ECF : 0 profil, 0 affectation, 0 fiche profs du personnel d''ECF hors de ce qu''un stagiaire lit', r.nom),
      pg_temp.clo_compter_entete(r.nom, v_pa, 'user_profiles', v_a) || '/' || pg_temp.clo_compter_entete(r.nom, v_pa, 'affectations', v_a)
        || '/' || pg_temp.clo_lire_entete(r.nom, v_pa, format('select count(*)::text from public.user_profiles u where u.stagiaire_id is not null and u.stagiaire_id <> %s', r.fiche)),
      '0/0/OK 0');
  end loop;

  -- Personne ne lit un profil du personnel de l'autre organisme ; chacun lit celui du sien.
  for r in select p.nom, case p.org when 'A' then v_b else v_a end as ailleurs, case p.org when 'A' then v_a else v_b end as chez
             from pg_temp.clo_perso p where p.nom in ('siege_a', 'dir_a', 'form_a', 'stag_a', 'fond_a', 'siege_b', 'dir_b', 'form_b', 'stag_b1', 'ex_form_b', 'ex_siege_b', 'ex_form_b2') loop
    v := pg_temp.clo_lire(r.nom, 'select coalesce(array_agg(email), ''{}'')::text from public.user_profiles where stagiaire_id is null');
    perform pg_temp.attendre('personnel', format('%s : 0 profil du personnel de l''autre organisme lu', r.nom),
      case when v like 'OK %' then pg_temp.calcul(format('select count(*)::text from unnest(%L::text[]) e where pg_temp.clo_org_compte(e) = %s', substr(v, 4), r.ailleurs)) else v end, '0');
  end loop;
  perform pg_temp.attendre('personnel', 'la direction de B lit le profil du formateur de B, celle d''ECF celui du formateur d''ECF (dir_b / dir_a)',
    pg_temp.clo_lire('dir_b', format('select count(*)::text from public.user_profiles where email = %L', (select email from pg_temp.clo_perso where nom = 'form_b')))
      || ' / ' || pg_temp.clo_lire('dir_a', format('select count(*)::text from public.user_profiles where email = %L', v_form_a)),
    'OK 1 / OK 1');
end $cgpe$;

-- Groupe annuaire (étape 2c) : partage, relais et fiches de l'annuaire limités aux centres de l'organisme ; le fondateur, sur
-- l'organisme de la fiche seulement.
create or replace function pg_temp.groupe_annuaire()
returns void language plpgsql as $cgan$
declare
  v_a text := pg_temp.clo_n('org_a'); v_b text := pg_temp.clo_n('org_b');
  v_la text := pg_temp.clo_n('lieu_a'); v_lb text := pg_temp.clo_n('lieu_b');
  v_lb2 text; v_fiche text; v_prof_a text; v text; r record;
  v_dir_b text := (select email from pg_temp.clo_perso where nom = 'dir_b');
  c_relais constant text := $q$select coalesce((select array_agg((r ->> 'id')::bigint) from jsonb_array_elements(f -> 'relais_possibles') r), '{}')::text from public.ma_fiche_contact() f$q$;
begin
  -- Un second centre de B, et une fiche sans compte de B (propriétaire, sans jeton : aucun contrôle de droit).
  v_lb2 := pg_temp.calcul(format($q$insert into public.lieux (nom, organisme_id) values ('Preuve clo annuaire B2', %s) returning id::text$q$, v_b));
  v_fiche := pg_temp.calcul(format($q$insert into public.contacts (prenom, nom, role, lieu_id) values ('Preuve', 'clo fiche B', 'Secrétariat', %s) returning id::text$q$, v_lb));
  v_prof_a := pg_temp.calcul(format('select min(pf.id)::text from public.profs pf where pf.organisme_id = %s', v_a));
  perform pg_temp.attendre('annuaire', 'la direction de B partage une fiche de son centre avec un centre d''ECF : refusé (« Centre inconnu. »)',
    pg_temp.clo_ecrire('dir_b', format($q$insert into public.contacts (prenom, nom, role, lieu_id, lieux_partages) values ('Preuve', 'clo partage', 'Secrétariat', %s, array[%s])$q$, v_lb, v_la)),
    'ERREUR P0001 contact: Centre inconnu.');
  perform pg_temp.attendre('annuaire', 'la direction de B relie une fiche à une fiche profs d''ECF : refusé (absente du planning de ce centre)',
    pg_temp.clo_ecrire('dir_b', format($q$insert into public.contacts (prenom, nom, role, lieu_id, prof_id) values ('Preuve', 'clo prof ECF', 'Formateur', %s, %s)$q$, v_lb, coalesce(v_prof_a, 'null'))),
    'ERREUR 42501 contact: Ce formateur ne figure pas au planning de ce centre.');
  -- Le fondateur (propriétaire avec son jeton : le déclencheur juge le jeton) : hors support, une fiche de B n'est pas la sienne.
  perform pg_temp.attendre('annuaire', 'fondateur hors support : partager une fiche de B avec un autre centre de B est refusé (le contournement du fondateur ne vaut que sur son organisme actif)',
    pg_temp.clo_ecrire('fond_a', format('update public.contacts set lieux_partages = array[%s] where id = %s', coalesce(v_lb2, 'null'), coalesce(v_fiche, 'null')), true),
    'ERREUR 42501 contact: Vous ne pouvez partager une fiche qu''avec un centre où vous écrivez les fiches.');
  perform pg_temp.attendre('annuaire', 'fondateur hors support : partager une fiche de B avec un centre d''ECF est refusé (« Centre inconnu. »)',
    pg_temp.clo_ecrire('fond_a', format('update public.contacts set lieux_partages = array[%s] where id = %s', v_la, coalesce(v_fiche, 'null')), true),
    'ERREUR P0001 contact: Centre inconnu.');
  perform pg_temp.attendre('annuaire', 'fondateur en support sur B : partager la fiche de B avec l''autre centre de B est accepté',
    left(pg_temp.clo_lire('fond_a', format($q$select (public.ouvrir_acces_support(%s, 'Support de la preuve de l''annuaire', '1 hour')).organisme_id::text$q$, v_b)), 3)
      || pg_temp.clo_ecrire('fond_a', format('update public.contacts set lieux_partages = array[%s] where id = %s', coalesce(v_lb2, 'null'), coalesce(v_fiche, 'null')), true)
      || ' ; ' || pg_temp.clo_lire('fond_a', 'select ''fermé'' from public.fermer_acces_support() f'),
    'OK OK 1 ; OK fermé');
  -- _contact_fiche_dans : une fiche de B dont la liste de partage porterait un centre d'ECF (donnée forgée) n'y paraît pas.
  perform pg_temp.attendre('annuaire', '_contact_fiche_dans : une fiche de B dont le partage citerait un centre d''ECF ne paraît pas dans ce centre ; elle paraît dans le sien',
    pg_temp.calcul(format($q$select public._contact_fiche_dans(jsonb_populate_record(c, jsonb_build_object('lieux_partages', jsonb_build_array(%1$s))), %1$s)::text
        || '/' || public._contact_fiche_dans(c, %2$s)::text from public.contacts c where c.id = %3$s$q$, v_la, v_lb, coalesce(v_fiche, 'null'))),
    'false/true');
  -- annuaire_centre : aucune fiche de l'autre organisme ; chacun voit les siennes.
  for r in select * from (values ('dir_a', v_b), ('form_a', v_b), ('dir_b', v_a), ('form_b', v_a), ('ex_form_b', v_a)) x(nom, ailleurs) loop
    v := pg_temp.clo_lire(r.nom, 'select coalesce(array_agg(a.id), ''{}'')::text from public.annuaire_centre() a');
    perform pg_temp.attendre('annuaire', format('%s : annuaire_centre() ne rend aucune fiche de l''autre organisme', r.nom),
      case when v like 'OK %' then pg_temp.calcul(format('select count(*)::text from unnest(%L::bigint[]) x where pg_temp.clo_org_contact(x) = %s', substr(v, 4), r.ailleurs)) else v end, '0');
  end loop;
  perform pg_temp.attendre('annuaire', 'la direction de B voit dans annuaire_centre() la fiche sans compte de son centre et la sienne',
    pg_temp.clo_lire('dir_b', format('select count(*)::text from public.annuaire_centre() a where a.id in (%s, %s)', coalesce(v_fiche, 'null'), pg_temp.clo_n('fiche_b'))),
    'OK 2');
  -- ma_fiche_contact et _contact_relais_possibles : les centres et les relais de son organisme seulement.
  perform pg_temp.attendre('annuaire', 'ma_fiche_contact() de la direction de B : ses centres = son centre de B exactement',
    pg_temp.clo_lire('dir_b', $q$select coalesce((select string_agg(c ->> 'id', ',') from jsonb_array_elements(f -> 'centres') c), 'aucun') from public.ma_fiche_contact() f$q$),
    'OK ' || v_lb);
  v := pg_temp.clo_lire('dir_b', c_relais);
  perform pg_temp.attendre('annuaire', 'ma_fiche_contact() de la direction de B : aucun relais proposé n''est une fiche d''ECF',
    case when v like 'OK %' then pg_temp.calcul(format('select count(*)::text from unnest(%L::bigint[]) x where pg_temp.clo_org_contact(x) = %s', substr(v, 4), v_a)) else v end, '0');
  perform pg_temp.attendre('annuaire', '_contact_relais_possibles (direction de B, direction d''ECF) : aucune fiche de l''autre organisme',
    pg_temp.calcul(format('select count(*)::text from public._contact_relais_possibles(%L) r where pg_temp.clo_org_contact(r.id) = %s', v_dir_b, v_a))
      || '/' || pg_temp.calcul(format('select count(*)::text from public._contact_relais_possibles(%L) r where pg_temp.clo_org_contact(r.id) = %s', (select email from pg_temp.clo_perso where nom = 'dir_a'), v_b)),
    '0/0');
end $cgan$;

-- Groupe planning (étape 2c) : les fiches profs lues et écrites dans l'organisme ; un même nom dans deux organismes.
create or replace function pg_temp.groupe_planning()
returns void language plpgsql as $cgpl$
declare
  v_a text := pg_temp.clo_n('org_a'); v_b text := pg_temp.clo_n('org_b');
  v_prof_a text; v_prof_b text := pg_temp.clo_n('prof_b'); v_nom_a text; v_nom_b text; r record;
begin
  v_prof_a := pg_temp.calcul(format('select min(pf.id)::text from public.profs pf where pf.organisme_id = %s', v_a));
  v_nom_a := pg_temp.calcul(format('select nom from public.profs where id = %s', coalesce(v_prof_a, 'null')));
  v_nom_b := pg_temp.calcul(format('select nom from public.profs where id = %s', v_prof_b));
  for r in select p.nom, case p.org when 'A' then v_b else v_a end as ailleurs from pg_temp.clo_perso p
            where p.nom in ('siege_a', 'dir_a', 'form_a', 'stag_a', 'fond_a', 'siege_b', 'dir_b', 'form_b', 'stag_b1', 'ex_form_b') loop
    perform pg_temp.attendre('planning', format('%s : aucune fiche profs de l''autre organisme lue', r.nom), pg_temp.clo_compter(r.nom, 'profs', r.ailleurs), '0');
  end loop;
  perform pg_temp.attendre('planning', 'le formateur et un stagiaire de B lisent les fiches profs de B, ceux d''ECF celles d''ECF (form_b / stag_b1 / form_a / stag_a : au moins une)',
    (pg_temp.clo_compter('form_b', 'profs', v_b) ~ '^[1-9]')::text || '/' || (pg_temp.clo_compter('stag_b1', 'profs', v_b) ~ '^[1-9]')::text
      || '/' || (pg_temp.clo_compter('form_a', 'profs', v_a) ~ '^[1-9]')::text || '/' || (pg_temp.clo_compter('stag_a', 'profs', v_a) ~ '^[1-9]')::text,
    'true/true/true/true');
  perform pg_temp.attendre('planning', 'la fiche profs de B porte le nom d''une fiche d''ECF (unicité propre à l''organisme)',
    pg_temp.calcul(format('select (%L in (select nom from public.profs where organisme_id = %s))::text', v_nom_b, v_a)),
    'true');
  perform pg_temp.attendre('planning', 'un doublon de nom dans B, puis dans ECF : refusés (23505)',
    left(pg_temp.clo_ecrire_annule('form_b', format('insert into public.profs (nom) values (%L)', v_nom_b)), 12)
      || ' / ' || left(pg_temp.clo_ecrire_annule('form_a', format('insert into public.profs (nom) values (%L)', v_nom_a)), 12),
    'ERREUR 23505 / ERREUR 23505');
  perform pg_temp.attendre('planning', 'le formateur de B : modifier ou supprimer une fiche profs d''ECF ne touche rien ; en créer une avec l''organisme d''ECF écrit en clair est refusé (42501)',
    pg_temp.clo_ecrire_annule('form_b', format('update public.profs set ordre = ordre where id = %s', coalesce(v_prof_a, 'null')))
      || ' / ' || pg_temp.clo_ecrire_annule('form_b', format('delete from public.profs where id = %s', coalesce(v_prof_a, 'null')))
      || ' / ' || left(pg_temp.clo_ecrire_annule('form_b', format('insert into public.profs (nom, organisme_id) values (''Preuve clo prof forgé'', %s)', v_a)), 12),
    'OK 0 / OK 0 / ERREUR 42501');
  perform pg_temp.attendre('planning', 'le formateur d''ECF : la fiche profs de B, ni modifiée ni supprimée ; une fiche avec l''organisme de B écrit en clair : refusée (42501)',
    pg_temp.clo_ecrire_annule('form_a', format('update public.profs set ordre = ordre where id = %s', v_prof_b))
      || ' / ' || pg_temp.clo_ecrire_annule('form_a', format('delete from public.profs where id = %s', v_prof_b))
      || ' / ' || left(pg_temp.clo_ecrire_annule('form_a', format('insert into public.profs (nom, organisme_id) values (''Preuve clo prof forgé A'', %s)', v_b)), 12),
    'OK 0 / OK 0 / ERREUR 42501');
  perform pg_temp.attendre('planning', 'le formateur de B crée une fiche profs dans B (témoin)',
    pg_temp.clo_ecrire_annule('form_b', $q$insert into public.profs (nom) values ('Preuve clo prof témoin B')$q$), 'OK 1');
  -- Règle 4 du contrôleur : une fois B créé, le formateur d'ECF sans en-tête crée encore une fiche sans organisme_id.
  perform pg_temp.attendre('planning', 'règle 4 : le formateur d''ECF, sans en-tête, crée une fiche profs sans organisme_id : acceptée, elle prend ECF',
    pg_temp.clo_ecrire('form_a_sans', $q$insert into public.profs (nom) values ('Preuve clo prof sans en-tête')$q$)
      || ' ; ' || pg_temp.org_de('profs', $q$nom = 'Preuve clo prof sans en-tête'$q$),
    'OK 1 ; ' || v_a);
end $cgpl$;

-- Groupe contenus (étape 2c) : B lit les cours et les QCM publiés et n'écrit ni cours, ni question, ni option, ni image, ni thème,
-- ni compétence, ni QCM ; ECF (rédacteur) les écrit. Ressources : commune, d'ECF, de B. Les écritures d'essai sont annulées.
create or replace function pg_temp.groupe_contenus()
returns void language plpgsql as $cgco$
declare
  v_a text := pg_temp.clo_n('org_a'); v_b text := pg_temp.clo_n('org_b');
  v_pa text := pg_temp.clo_n('promo_a'); v_pb text := pg_temp.clo_n('promo_b');
  v_cours text; v_qcm text; v_q text; v_theme text; v_theme_libre text; v_qcm_neuf text; v_res_a text; v_res_b text := pg_temp.clo_n('res_b');
  v_ecritures text; r record; v text;
begin
  v_cours := pg_temp.calcul($q$select quote_literal(min(id::text)) from public.cours where published$q$);
  v_qcm := pg_temp.calcul('select min(id)::text from public.qcm');
  v_q := pg_temp.calcul('select min(id)::text from public.qcm_questions');
  v_theme := pg_temp.calcul('select min(id)::text from public.themes');
  v_theme_libre := pg_temp.calcul('select min(t.id)::text from public.themes t where not exists (select 1 from public.qcm q where q.theme_id = t.id)');
  v_qcm_neuf := pg_temp.calcul('select (max(id) + 1000)::text from public.qcm');
  -- Lecture des contenus publiés : tous.
  for r in select * from (values ('form_b'), ('stag_b1'), ('dir_b'), ('siege_b'), ('form_a'), ('stag_a')) x(nom) loop
    perform pg_temp.attendre('contenus', format('%s lit les cours publiés, les QCM et leurs questions', r.nom),
      pg_temp.clo_lire(r.nom, 'select concat_ws(''|'', (select count(*) > 0 from public.cours where published), (select count(*) > 0 from public.qcm), (select count(*) > 0 from public.qcm_questions), (select count(*) > 0 from public.qcm_options))'),
      'OK t|t|t|t');
  end loop;
  -- Les gestes des contenus : seulement dans l'organisme rédacteur.
  perform pg_temp.attendre('contenus', 'formateur de B, sa promo : contenus.rediger, contenus.lire_internes, contenus.traiter, referentiel.modifier faux ; direction de B : contenus.lire_internes faux',
    pg_temp.clo_lire('form_b', format($q$select concat_ws('|', public.geste_promo(%1$s, 'contenus.rediger'), public.geste_promo(%1$s, 'contenus.lire_internes'),
        public.geste_promo(%1$s, 'contenus.traiter'), public.geste_promo(%1$s, 'referentiel.modifier'))$q$, v_pb), true)
      || ' ; ' || pg_temp.clo_lire('dir_b', format($q$select public.geste_promo(%s, 'contenus.lire_internes')::text$q$, v_pb), true),
    'OK f|f|f|f ; OK false');
  perform pg_temp.attendre('contenus', 'formateur d''ECF, sa promo : les quatre gestes des contenus vrais (témoin)',
    pg_temp.clo_lire('form_a', format($q$select concat_ws('|', public.geste_promo(%1$s, 'contenus.rediger'), public.geste_promo(%1$s, 'contenus.lire_internes'),
        public.geste_promo(%1$s, 'contenus.traiter'), public.geste_promo(%1$s, 'referentiel.modifier'))$q$, v_pa), true),
    'OK t|t|t|t');
  perform pg_temp.attendre('contenus', 'case_reseau(cours) : siège de B 0, siège d''ECF au plafond ; geste_promo(nul, contenus.rediger) du siège de B faux',
    pg_temp.clo_lire('siege_b', $q$select public.case_reseau('cours') || '|' || public.geste_promo(null, 'contenus.rediger')$q$, true)
      || ' / ' || pg_temp.clo_lire('siege_a', $q$select public.case_reseau('cours') || '|' || public.geste_promo(null, 'contenus.rediger')$q$, true),
    'OK 0|false / OK 2|true');
  -- Les écritures (annulées) : refusées pour le formateur de B, acceptées pour le formateur d'ECF.
  for r in select * from (values ('form_b', 'B'), ('form_a', 'A')) x(nom, o) loop
    v_ecritures := concat_ws(' | ',
      left(pg_temp.clo_ecrire_annule(r.nom, format('update public.cours set titre = titre where id = %s', coalesce(v_cours, 'null'))), 12),
      left(pg_temp.clo_ecrire_annule(r.nom, format($q$insert into public.qcm_questions (qcm_id, enonce, ordre) values (%s, 'Preuve clo question', 999)$q$, coalesce(v_qcm, 'null'))), 12),
      left(pg_temp.clo_ecrire_annule(r.nom, format($q$insert into public.qcm_options (question_id, texte, is_correct, ordre) values (%s, 'Preuve clo option', false, 99)$q$, coalesce(v_q, 'null'))), 12),
      left(pg_temp.clo_ecrire_annule(r.nom, format('update public.themes set titre = titre where id = %s', coalesce(v_theme, 'null'))), 12),
      left(pg_temp.clo_ecrire_annule(r.nom, $q$insert into public.competences (code, libelle, ordre) values ('PREUVE-CLO', 'Preuve clo compétence', 999)$q$), 12),
      left(pg_temp.clo_ecrire_annule(r.nom, format($q$insert into public.qcm (id, theme_id, titre) values (%s, %s, 'Preuve clo QCM')$q$, coalesce(v_qcm_neuf, 'null'), coalesce(v_theme_libre, 'null'))), 12),
      left(pg_temp.clo_ecrire_annule(r.nom, $q$insert into storage.objects (bucket_id, name) values ('cours-images', 'preuve-clo/cours.png')$q$), 12),
      left(pg_temp.clo_ecrire_annule(r.nom, $q$insert into storage.objects (bucket_id, name) values ('qcm-images', 'preuve-clo/qcm.png')$q$), 12));
    perform pg_temp.attendre('contenus', format('%s écrit : cours (modification) | question | option | thème (modification) | compétence | QCM | image de cours | image de QCM', r.nom),
      v_ecritures,
      case r.o when 'B' then 'OK 0 | ERREUR 42501 | ERREUR 42501 | OK 0 | ERREUR 42501 | ERREUR 42501 | ERREUR 42501 | ERREUR 42501'
               else 'OK 1 | OK 1 | OK 1 | OK 1 | OK 1 | OK 1 | OK 1 | OK 1' end);
  end loop;
  perform pg_temp.attendre('contenus', 'formateur de B : aucun cours interne (non publié, sans code) lu ; formateur d''ECF : tous',
    pg_temp.clo_lire('form_b', 'select count(*)::text from public.cours where not published and code is null')
      || ' / ' || pg_temp.clo_lire('form_a', 'select (count(*) = (select count(*) from public.cours c where not c.published and c.code is null))::text from public.cours where not published and code is null'),
    'OK 0 / OK true');

  -- Ressources : une carte d'ECF, une de B ; une carte commune lue par tous et écrite par le rédacteur seul.
  v_res_a := pg_temp.calcul(format('select min(id)::text from public.ressources where organisme_id = %s', v_a));
  perform pg_temp.attendre('contenus', 'ressources : un stagiaire de B ne lit aucune carte d''ECF et lit celle de B ; un stagiaire d''ECF ne lit aucune carte de B',
    pg_temp.clo_compter('stag_b1', 'ressources', v_a) || '/' || pg_temp.clo_lire('stag_b1', format('select count(*)::text from public.ressources where id = %s', v_res_b))
      || '/' || pg_temp.clo_compter('stag_a', 'ressources', v_b),
    '0/OK 1/0');
  v := pg_temp.calcul(format('with m as (update public.ressources set organisme_id = null where id = %s returning 1) select count(*)::text from m', coalesce(v_res_a, 'null')));
  perform pg_temp.attendre('contenus', 'ressources : une carte d''ECF marquée commune (organisme nul, propriétaire) le reste, un stagiaire de B la lit ; le formateur de B ne la modifie pas, celui d''ECF (rédacteur) oui',
    v || ' ; ' || pg_temp.org_de('ressources', format('id = %s', coalesce(v_res_a, 'null')))
      || ' ; ' || pg_temp.clo_lire('stag_b1', format('select count(*)::text from public.ressources where id = %s', coalesce(v_res_a, 'null')))
      || ' ; ' || pg_temp.clo_ecrire_annule('form_b', format('update public.ressources set ordre = ordre where id = %s', coalesce(v_res_a, 'null')))
      || ' ; ' || pg_temp.clo_ecrire_annule('form_a', format('update public.ressources set ordre = ordre where id = %s', coalesce(v_res_a, 'null'))),
    '1 ; nul ; OK 1 ; OK 0 ; OK 1');
  perform pg_temp.calcul(format('with m as (update public.ressources set organisme_id = %s where id = %s returning 1) select count(*)::text from m', v_a, coalesce(v_res_a, 'null')));
  perform pg_temp.attendre('contenus', 'ressources, formateur de B : sa carte modifiée ; une carte d''ECF ni modifiée ni supprimée ; une carte avec l''organisme d''ECF écrit en clair refusée (42501)',
    pg_temp.clo_ecrire_annule('form_b', format('update public.ressources set ordre = ordre where id = %s', v_res_b))
      || ' / ' || pg_temp.clo_ecrire_annule('form_b', format('update public.ressources set ordre = ordre where id = %s', coalesce(v_res_a, 'null')))
      || ' / ' || pg_temp.clo_ecrire_annule('form_b', format('delete from public.ressources where id = %s', coalesce(v_res_a, 'null')))
      || ' / ' || left(pg_temp.clo_ecrire_annule('form_b', format($q$insert into public.ressources (titre, url, categorie, organisme_id) values ('Preuve clo carte forgée', 'https://exemple.invalid/f', 'docs', %s)$q$, v_a)), 12),
    'OK 1 / OK 0 / OK 0 / ERREUR 42501');
  -- Règle 4 du contrôleur.
  perform pg_temp.attendre('contenus', 'règle 4 : le formateur d''ECF, sans en-tête, crée une carte Ressources sans organisme_id : acceptée, elle prend ECF',
    pg_temp.clo_ecrire('form_a_sans', $q$insert into public.ressources (titre, url, categorie) values ('Preuve clo carte sans en-tête', 'https://exemple.invalid/s', 'docs')$q$)
      || ' ; ' || pg_temp.org_de('ressources', $q$titre = 'Preuve clo carte sans en-tête'$q$),
    'OK 1 ; ' || v_a);
end $cgco$;

-- Groupe signalements (étape 2c) : les signalements de QCM lus et traités par l'équipe de l'organisme de la ligne ; instructions et
-- brouillons de l'IA au rédacteur seul.
create or replace function pg_temp.groupe_signalements()
returns void language plpgsql as $cgsg$
declare
  v_a text := pg_temp.clo_n('org_a'); v_b text := pg_temp.clo_n('org_b');
  v_sig_b text := pg_temp.clo_n('sig_b'); v_sig_a text; v_brouillon text; v_q text; v_fiche_b text;
begin
  v_sig_a := pg_temp.calcul(format('select min(id)::text from public.qcm_signalements where organisme_id = %s', v_a));
  v_q := pg_temp.calcul('select min(id)::text from public.qcm_questions');
  v_fiche_b := pg_temp.clo_n('stag_b1');
  perform pg_temp.attendre('signalements', 'le formateur d''ECF (rédacteur) ne lit pas le signalement de B (ni sa fiche de stagiaire) ; aucun signalement de B lu',
    pg_temp.clo_lire('form_a', format('select count(*)::text from public.qcm_signalements where id = %s', v_sig_b)) || '/' || pg_temp.clo_compter('form_a', 'qcm_signalements', v_b),
    'OK 0/0');
  perform pg_temp.attendre('signalements', 'le formateur de B lit le signalement de son stagiaire, fiche comprise ; aucun signalement d''ECF',
    pg_temp.clo_lire('form_b', format('select count(*)::text from public.qcm_signalements where id = %s and stagiaire_id = %s', v_sig_b, v_fiche_b)) || '/' || pg_temp.clo_compter('form_b', 'qcm_signalements', v_a),
    'OK 1/0');
  perform pg_temp.attendre('signalements', 'traitement : le formateur d''ECF ne modifie pas le signalement de B ; celui de B le modifie, mais ne le passe pas à ECF (42501) ; il ne supprime pas un signalement d''ECF',
    pg_temp.clo_ecrire_annule('form_a', format('update public.qcm_signalements set statut = statut where id = %s', v_sig_b))
      || ' / ' || pg_temp.clo_ecrire_annule('form_b', format('update public.qcm_signalements set statut = statut where id = %s', v_sig_b))
      || ' / ' || left(pg_temp.clo_ecrire_annule('form_b', format('update public.qcm_signalements set organisme_id = %s where id = %s', v_a, v_sig_b)), 12)
      || ' / ' || pg_temp.clo_ecrire_annule('form_b', format('delete from public.qcm_signalements where id = %s', coalesce(v_sig_a, 'null'))),
    'OK 0 / OK 1 / ERREUR 42501 / OK 0');
  perform pg_temp.attendre('signalements', 'fondateur hors support : le signalement de B non lu ; en support sur B : lu, et celui d''ECF non',
    pg_temp.clo_lire('fond_a', format('select count(*)::text from public.qcm_signalements where id = %s', v_sig_b))
      || ' ; ' || left(pg_temp.clo_lire('fond_a', format($q$select (public.ouvrir_acces_support(%s, 'Support de la preuve des signalements', '1 hour')).organisme_id::text$q$, v_b)), 3)
      || pg_temp.clo_lire('fond_a', format('select count(*) filter (where id = %s) || ''/'' || count(*) filter (where id = %s) from public.qcm_signalements', v_sig_b, coalesce(v_sig_a, 'null')))
      || ' ; ' || pg_temp.clo_lire('fond_a', 'select ''fermé'' from public.fermer_acces_support() f'),
    'OK 0 ; OK OK 1/0 ; OK fermé');
  perform pg_temp.attendre('signalements', 'un stagiaire de B signale avec l''organisme d''ECF écrit en clair : refusé (42501, sans RETURNING)',
    left(pg_temp.clo_ecrire_annule('stag_b1', format($q$insert into public.qcm_signalements (question_id, email, stagiaire_id, motif, organisme_id) values (%s, lower(auth.jwt() ->> 'email'), %s, 'autre', %s)$q$, coalesce(v_q, 'null'), v_fiche_b, v_a)), 12),
    'ERREUR 42501');
  -- Règle 4 du contrôleur.
  perform pg_temp.attendre('signalements', 'règle 4 : le stagiaire d''ECF, sans en-tête, signale une question sans organisme_id : accepté, le signalement prend ECF',
    pg_temp.clo_ecrire('stag_a_sans', format($q$insert into public.qcm_signalements (question_id, email, motif, commentaire) values (%s, lower(auth.jwt() ->> 'email'), 'autre', 'Preuve clo sans en-tête')$q$, coalesce(v_q, 'null')))
      || ' ; ' || pg_temp.org_de('qcm_signalements', $q$commentaire = 'Preuve clo sans en-tête'$q$),
    'OK 1 ; ' || v_a);
  -- Instructions et brouillons de l'IA : au rédacteur seul.
  perform pg_temp.calcul(format($q$insert into public.qcm_signalement_instruction (signalement_id, verdict_auto, analyse_auto) values (%s, 'Preuve clo', 'Preuve clo analyse') returning 1$q$, v_sig_b));
  v_brouillon := pg_temp.calcul(format($q$insert into public.qcm_ia_brouillons (qcm_id, demande_par_email, enonce) values ((select min(id) from public.qcm), 'preuve.clo@exemple.invalid', 'Preuve clo brouillon') returning id::text$q$));
  perform pg_temp.attendre('signalements', 'qcm_signalement_instruction et qcm_ia_brouillons : le formateur de B n''en lit aucune ligne, celui d''ECF les lit',
    pg_temp.clo_lire('form_b', 'select (select count(*) from public.qcm_signalement_instruction) || ''/'' || (select count(*) from public.qcm_ia_brouillons)')
      || ' / ' || pg_temp.clo_lire('form_a', format('select (select count(*) > 0 from public.qcm_signalement_instruction) || ''/'' || (select count(*) from public.qcm_ia_brouillons where id = %s)', coalesce(v_brouillon, 'null'))),
    'OK 0/0 / OK true/1');
  perform pg_temp.attendre('signalements', 'le formateur de B n''accepte ni ne rejette un brouillon de l''IA ; is_admin() faux pour lui, vrai pour le formateur d''ECF',
    left(pg_temp.clo_lire('form_b', format($q$select public.accepter_brouillon_ia(%s, 'Énoncé', null, null, '[{"texte":"a","is_correct":true},{"texte":"b"}]')::text$q$, coalesce(v_brouillon, 'null'))), 12)
      || ' / ' || left(pg_temp.clo_lire('form_b', format('select public.rejeter_brouillon_ia(%s)::text', coalesce(v_brouillon, 'null'))), 12)
      || ' / ' || pg_temp.clo_lire('form_b', 'select public.is_admin()::text') || ' / ' || pg_temp.clo_lire('form_a', 'select public.is_admin()::text'),
    'ERREUR 42501 / ERREUR 42501 / OK false / OK true');
end $cgsg$;

-- Groupe qualite (étape 2c, règle 1 du contrôleur : bornage complet) : registre, ouvertures et résultats des questionnaires,
-- etat_conservation, effacer_*, journal des effacements, conditions acceptées, profils : le fondateur hors support ne lit ni ne
-- modifie rien de B ; en support sur B, ceux de B sont ouverts et ceux d'ECF refusés.
create or replace function pg_temp.groupe_qualite()
returns void language plpgsql as $cgq$
declare
  v_a text := pg_temp.clo_n('org_a'); v_b text := pg_temp.clo_n('org_b');
  v_pa text := pg_temp.clo_n('promo_a'); v_pb text := pg_temp.clo_n('promo_b');
  v_la text := pg_temp.clo_n('lieu_a'); v_lb text := pg_temp.clo_n('lieu_b');
  v_fiche_b text := pg_temp.clo_n('stag_b1'); v_fiche_a text;
  v_rq_a text; v_rq_b text; v_ej_a text; v_ej_b text; v_ca text; v_cb text; v_dir_a text; v_dir_b text; v_orph text;
  v text; v_attendu text;
  c_porte_b constant text := '{"promo_id": %s}';
begin
  v_fiche_a := pg_temp.calcul(format('select stagiaire_id::text from public.user_profiles where email = %L', (select email from pg_temp.clo_perso where nom = 'stag_a')));
  v_dir_a := (select email from pg_temp.clo_perso where nom = 'dir_a');
  v_dir_b := (select email from pg_temp.clo_perso where nom = 'dir_b');
  -- Les lignes de chaque organisme (propriétaire).
  v_rq_a := pg_temp.calcul(format($q$insert into public.registre_qualite (type, date_constat, origine, lieu_id, description) values ('alea', current_date, 'equipe', %s, 'Preuve clo registre A') returning id::text$q$, v_la));
  v_rq_b := pg_temp.calcul(format($q$insert into public.registre_qualite (type, date_constat, origine, lieu_id, description) values ('alea', current_date, 'equipe', %s, 'Preuve clo registre B') returning id::text$q$, v_lb));
  perform pg_temp.calcul(format($q$insert into public.questionnaire_ouvertures (cle, promo_id, ouvert, par_email) values ('fin_stagiaire', %s, true, 'preuve') on conflict do nothing returning 1$q$, v_pb));
  perform pg_temp.calcul(format($q$insert into public.questionnaire_ouvertures (cle, promo_id, ouvert, par_email) values ('six_mois_stagiaire', %s, true, 'preuve') on conflict do nothing returning 1$q$, v_pa));
  v_ej_a := pg_temp.calcul(format($q$insert into public.effacements_journal (type, cible, fait_par_email, details) values ('etape1', 'promo %s', 'preuve', '{}') returning id::text$q$, v_pa));
  v_ej_b := pg_temp.calcul(format($q$insert into public.effacements_journal (type, cible, fait_par_email, details) values ('etape1', 'promo %s', 'preuve', '{}') returning id::text$q$, v_pb));
  perform pg_temp.calcul(format($q$insert into public.effacements_journal (type, cible, fait_par_email, details) values ('demande', 'stagiaire %s', 'preuve', '{}') returning 1$q$, v_fiche_b));
  v_ca := pg_temp.calcul(format($q$insert into public.conditions_acceptations (email, version) values (%L, 'preuve-clo') returning id::text$q$, (select email from pg_temp.clo_perso where nom = 'stag_a')));
  v_cb := pg_temp.calcul(format($q$insert into public.conditions_acceptations (email, version) values (%L, 'preuve-clo') returning id::text$q$, (select email from pg_temp.clo_perso where nom = 'stag_b1')));
  insert into public.user_profiles (email, role, is_admin, invited_by_email) values ('preuve.clo.invitee.b@exemple.invalid', 'stagiaire', false, v_dir_b);
  v_orph := 'preuve.clo.invitee.b@exemple.invalid';

  -- Hors support.
  perform pg_temp.attendre('qualite', 'fondateur hors support : registre, ligne de B / ligne d''ECF lues ; ouvertures de questionnaires de B / d''ECF ; journal des effacements de B / d''ECF ; conditions acceptées de B / d''ECF',
    pg_temp.clo_lire('fond_a', format($q$select concat_ws('|',
        (select count(*) filter (where id = %s) || '/' || count(*) filter (where id = %s) from public.registre_qualite),
        (select count(*) filter (where promo_id = %s) || '/' || count(*) filter (where promo_id = %s) from public.questionnaire_ouvertures),
        (select count(*) filter (where id = %s) || '/' || count(*) filter (where id = %s) from public.effacements_journal),
        (select count(*) filter (where id = %s) || '/' || count(*) filter (where id = %s) from public.conditions_acceptations))$q$,
      coalesce(v_rq_b, 'null'), coalesce(v_rq_a, 'null'), v_pb, v_pa, coalesce(v_ej_b, 'null'), coalesce(v_ej_a, 'null'), coalesce(v_cb, 'null'), coalesce(v_ca, 'null'))),
    'OK 0/1|0/1|0/1|0/1');
  perform pg_temp.attendre('qualite', 'fondateur hors support : profils, la direction de B / celle d''ECF ; l''invitation en cours de B / supprimer cette invitation (annulé)',
    pg_temp.clo_lire('fond_a', format('select count(*) filter (where email = %L) || ''/'' || count(*) filter (where email = %L) || ''/'' || count(*) filter (where email = %L) from public.user_profiles', v_dir_b, v_dir_a, v_orph))
      || ' ; ' || pg_temp.clo_ecrire_annule('fond_a', format('delete from public.user_profiles where email = %L', v_orph)),
    'OK 0/1/0 ; OK 0');
  perform pg_temp.attendre('qualite', 'fondateur hors support, registre : modifier la ligne de B ne touche rien ; une entrée sur un centre de B ou avec l''organisme de B écrit en clair est refusée (42501) ; une entrée sans centre prend ECF',
    pg_temp.clo_ecrire_annule('fond_a', format('update public.registre_qualite set description = description where id = %s', coalesce(v_rq_b, 'null')))
      || ' / ' || left(pg_temp.clo_ecrire_annule('fond_a', format($q$insert into public.registre_qualite (type, date_constat, origine, lieu_id, description) values ('alea', current_date, 'equipe', %s, 'Preuve clo registre forgé')$q$, v_lb)), 12)
      || ' / ' || left(pg_temp.clo_ecrire_annule('fond_a', format($q$insert into public.registre_qualite (type, date_constat, origine, description, organisme_id) values ('alea', current_date, 'equipe', 'Preuve clo registre forgé B', %s)$q$, v_b)), 12)
      || ' / ' || pg_temp.clo_ecrire('fond_a', $q$insert into public.registre_qualite (type, date_constat, origine, description) values ('amelioration', current_date, 'equipe', 'Preuve clo registre sans centre A')$q$)
      || ' ; ' || pg_temp.org_de('registre_qualite', $q$description = 'Preuve clo registre sans centre A'$q$),
    'OK 0 / ERREUR 42501 / ERREUR 42501 / OK 1 ; ' || v_a);
  perform pg_temp.attendre('qualite', 'fondateur hors support, questionnaires sur la promo de B : ouvrir (« Promo introuvable. »), résultats et commentaires refusés ; résultats sur une promo d''ECF lus',
    pg_temp.clo_lire('fond_a', format($q$select public.ouvrir_questionnaire('fin_stagiaire', '{"promo_id": %s}', true)::text$q$, v_pb))
      || ' / ' || pg_temp.clo_lire('fond_a', format($q$select (public.resultats_questionnaire('fin_stagiaire', '{"promo_id": %s}') ->> 'cle')$q$, v_pb))
      || ' / ' || pg_temp.clo_lire('fond_a', format($q$select count(*)::text from public.commentaires_questionnaire('fin_stagiaire', '{"promo_id": %s}')$q$, v_pb))
      || ' / ' || pg_temp.clo_lire('fond_a', format($q$select (public.resultats_questionnaire('fin_stagiaire', '{"promo_id": %s}') ->> 'cle')$q$, v_pa)),
    'ERREUR P0001 questionnaire: Promo introuvable. / ERREUR P0001 questionnaire: Réservé à la gestion de la qualité. / ERREUR P0001 questionnaire: Réservé à l''éditeur. / OK fin_stagiaire');
  v_attendu := pg_temp.calcul(format($q$select count(*) filter (where etat <> 'clos')::text from public.registre_qualite r
      where coalesce(pg_temp.clo_org_registre(r.id), %s) = %s$q$, v_a, v_a));
  perform pg_temp.attendre('qualite', 'fondateur hors support : etat_conservation() ne rend aucune promo ni aucun centre de B, et ne compte que le registre d''ECF (entrées à clore)',
    pg_temp.clo_lire('fond_a', $q$select (select coalesce(array_agg((p ->> 'id')::integer), '{}') from jsonb_array_elements(e -> 'promos') p)::text || '#'
        || (select coalesce(array_agg((p ->> 'lieu_id')::integer), '{}') from jsonb_array_elements(e -> 'portees_formateurs') p)::text || '#' || (e -> 'registre' ->> 'a_clore')
        from (select public.etat_conservation() e) x$q$),
    'OK ' || pg_temp.calcul(format($q$select coalesce(array_agg(pr.id order by pr.id), '{}')::text from public.promos pr where public.organisme_de_promo(pr.id) = %s$q$, v_a))
      || '#' || substr(pg_temp.clo_lire('fond_a', $q$select (select coalesce(array_agg((p ->> 'lieu_id')::integer), '{}') from jsonb_array_elements(e -> 'portees_formateurs') p)::text from (select public.etat_conservation() e) x$q$), 4)
      || '#' || coalesce(v_attendu, 'incalculable'));
  perform pg_temp.attendre('qualite', 'fondateur hors support : etat_conservation() ne rend aucune portée de questionnaire d''un centre de B',
    pg_temp.calcul(format('select count(*)::text from unnest(%L::integer[]) x where public.organisme_de_lieu(x) = %s',
      substr(pg_temp.clo_lire('fond_a', $q$select (select coalesce(array_agg((p ->> 'lieu_id')::integer), '{}') from jsonb_array_elements(e -> 'portees_formateurs') p)::text from (select public.etat_conservation() e) x$q$), 4), v_b)),
    '0');
  perform pg_temp.attendre('qualite', 'fondateur hors support : etat_conservation_centre(centre de B) refusé, (centre d''ECF) lu',
    pg_temp.clo_lire('fond_a', format('select (public.etat_conservation_centre(%s) ->> ''jour'') is not null', v_lb))
      || ' / ' || pg_temp.clo_lire('fond_a', format('select ((public.etat_conservation_centre(%s) ->> ''jour'') is not null)::text', v_la)),
    'ERREUR P0001 conservation: Réservé à la direction du centre. / OK true');
  perform pg_temp.attendre('qualite', 'fondateur hors support, sur B : effacer_sur_demande, effacer_promo_etape1, effacer_promo_etape2, clore_annee_formateurs, effacer_commentaires_formateurs, figer_questionnaire_formateurs refusés',
    concat_ws(' / ',
      pg_temp.clo_lire('fond_a', format('select public.effacer_sur_demande(%s)::text', v_fiche_b)),
      pg_temp.clo_lire('fond_a', format('select public.effacer_promo_etape1(%s)::text', v_pb)),
      pg_temp.clo_lire('fond_a', format('select public.effacer_promo_etape2(%s)::text', v_pb)),
      pg_temp.clo_lire('fond_a', format('select public.clore_annee_formateurs(%s, 2020)::text', v_lb)),
      pg_temp.clo_lire('fond_a', format('select public.effacer_commentaires_formateurs(%s, 2020)::text', v_lb)),
      pg_temp.clo_lire('fond_a', format('select public.figer_questionnaire_formateurs(%s, 2020)::text', v_lb))),
    'ERREUR P0001 conservation: Cette fiche n''est pas dans votre périmètre. / ERREUR P0001 conservation: Cette promo n''est pas dans votre périmètre. / ERREUR P0001 conservation: Cette promo n''est pas dans votre périmètre. / ERREUR P0001 conservation: Ce lieu n''est pas dans votre périmètre. / ERREUR P0001 conservation: Ce lieu n''est pas dans votre périmètre. / ERREUR P0001 conservation: Ce lieu n''est pas dans votre périmètre.');
  perform pg_temp.attendre('qualite', 'fondateur hors support : autonomie_opposer sur une fiche de B (« Fiche introuvable. »), rien d''écrit ; fiches_effacees_sur_demande(promo de B) vide',
    pg_temp.clo_lire('fond_a', format('select public.autonomie_opposer(%s)::text', v_fiche_b))
      || ' ; ' || pg_temp.calcul(format('select count(*)::text from public.autonomie_oppositions where stagiaire_id = %s', v_fiche_b))
      || ' ; ' || pg_temp.clo_lire('fond_a', format('select count(*)::text from public.fiches_effacees_sur_demande(array[%s])', v_pb)),
    'ERREUR P0001 autonomie: Fiche introuvable. ; 0 ; OK 0');
  -- effacer_registre_qualite : deux entrées closes depuis 4 ans (propriétaire, déclencheur d'écriture du registre suspendu le temps de
  -- les antidater), l'une d'ECF, l'autre de B ; le fondateur hors support n'efface que celle d'ECF.
  execute 'alter table public.registre_qualite disable trigger registre_qualite_avant';
  update public.registre_qualite set etat = 'clos', clos_le = now() - interval '4 years' where id::text in (v_rq_a, v_rq_b);
  execute 'alter table public.registre_qualite enable trigger registre_qualite_avant';
  perform pg_temp.attendre('qualite', 'fondateur hors support : effacer_registre_qualite() efface l''entrée échue d''ECF, jamais celle de B (description d''ECF / de B)',
    left(pg_temp.clo_lire('fond_a', 'select public.effacer_registre_qualite()::text'), 3)
      || pg_temp.calcul(format('select coalesce((select description from public.registre_qualite where id = %s), ''nul'') || '' / '' || coalesce((select description from public.registre_qualite where id = %s), ''nul'')', coalesce(v_rq_a, 'null'), coalesce(v_rq_b, 'null'))),
    'OK nul / Preuve clo registre B');

  -- En support sur B : ceux de B ouverts, ceux d'ECF refusés.
  perform pg_temp.attendre('qualite', 'le fondateur ouvre un support sur B',
    pg_temp.clo_lire('fond_a', format($q$select (public.ouvrir_acces_support(%s, 'Support de la preuve de la qualité', '1 hour')).organisme_id::text$q$, v_b)), 'OK ' || v_b);
  perform pg_temp.attendre('qualite', 'fondateur en support sur B : registre, ouvertures, journal des effacements, conditions acceptées de B lus, ceux d''ECF non (B/ECF)',
    pg_temp.clo_lire('fond_a', format($q$select concat_ws('|',
        (select count(*) filter (where id = %s) || '/' || count(*) filter (where id = %s) from public.registre_qualite),
        (select count(*) filter (where promo_id = %s) || '/' || count(*) filter (where promo_id = %s) from public.questionnaire_ouvertures),
        (select count(*) filter (where id = %s) || '/' || count(*) filter (where id = %s) from public.effacements_journal),
        (select count(*) filter (where id = %s) || '/' || count(*) filter (where id = %s) from public.conditions_acceptations))$q$,
      coalesce(v_rq_b, 'null'), coalesce(v_rq_a, 'null'), v_pb, v_pa, coalesce(v_ej_b, 'null'), coalesce(v_ej_a, 'null'), coalesce(v_cb, 'null'), coalesce(v_ca, 'null'))),
    'OK 1/0|1/0|1/0|1/0');
  perform pg_temp.attendre('qualite', 'fondateur en support sur B : profils, la direction de B / celle d''ECF ; supprimer l''invitation en cours de B (annulé)',
    pg_temp.clo_lire('fond_a', format('select count(*) filter (where email = %L) || ''/'' || count(*) filter (where email = %L) from public.user_profiles', v_dir_b, v_dir_a))
      || ' ; ' || pg_temp.clo_ecrire_annule('fond_a', format('delete from public.user_profiles where email = %L', v_orph)),
    'OK 1/0 ; OK 1');
  perform pg_temp.attendre('qualite', 'fondateur en support sur B : une entrée du registre sans centre prend B ; ouvrir un questionnaire d''une promo d''ECF (« Promo introuvable. ») ; résultats de B lus',
    pg_temp.clo_ecrire('fond_a', $q$insert into public.registre_qualite (type, date_constat, origine, description) values ('amelioration', current_date, 'equipe', 'Preuve clo registre sans centre B')$q$)
      || ' ; ' || pg_temp.org_de('registre_qualite', $q$description = 'Preuve clo registre sans centre B'$q$)
      || ' ; ' || pg_temp.clo_lire('fond_a', format($q$select public.ouvrir_questionnaire('six_mois_stagiaire', '{"promo_id": %s}', false)::text$q$, v_pa))
      || ' ; ' || pg_temp.clo_lire('fond_a', format($q$select (public.resultats_questionnaire('fin_stagiaire', '{"promo_id": %s}') ->> 'cle')$q$, v_pb)),
    'OK 1 ; ' || v_b || ' ; ERREUR P0001 questionnaire: Promo introuvable. ; OK fin_stagiaire');
  perform pg_temp.attendre('qualite', 'fondateur en support sur B : etat_conservation_centre(centre d''ECF) refusé, (centre de B) lu ; effacer_sur_demande et autonomie_opposer sur une fiche d''ECF refusés',
    pg_temp.clo_lire('fond_a', format('select (public.etat_conservation_centre(%s) ->> ''jour'') is not null', v_la))
      || ' / ' || pg_temp.clo_lire('fond_a', format('select ((public.etat_conservation_centre(%s) ->> ''jour'') is not null)::text', v_lb))
      || ' / ' || pg_temp.clo_lire('fond_a', format('select public.effacer_sur_demande(%s)::text', coalesce(v_fiche_a, 'null')))
      || ' / ' || pg_temp.clo_lire('fond_a', format('select public.autonomie_opposer(%s)::text', coalesce(v_fiche_a, 'null'))),
    'ERREUR P0001 conservation: Réservé à la direction du centre. / OK true / ERREUR P0001 conservation: Cette fiche n''est pas dans votre périmètre. / ERREUR P0001 autonomie: Fiche introuvable.');
  perform pg_temp.attendre('qualite', 'fermer_acces_support() par le fondateur', pg_temp.clo_lire('fond_a', 'select ''fermé'' from public.fermer_acces_support() f'), 'OK fermé');
end $cgq$;

-- Groupe matrice (étape 2c, § 5.6) : pour chaque personnage des deux organismes, chaque table classée et chaque fonction de lecture de
-- l'inventaire : aucune ligne de l'autre organisme lue ; aucune écriture (modification, suppression, sans RETURNING) vers une ligne de
-- l'autre organisme. Les tables sont lues dans pg_tables (schéma public) : une table ni classée ni en exception fait rougir la preuve.
create or replace function pg_temp.groupe_matrice()
returns void language plpgsql as $cgm$
declare
  v_a text := pg_temp.clo_n('org_a'); v_b text := pg_temp.clo_n('org_b');
  v_pb text := pg_temp.clo_n('promo_b'); v_lb text := pg_temp.clo_n('lieu_b');
  v text; v_liste text; v_col text; v_lignes tid[]; v_fuites text; v_ecritures text; v_fonctions text; v_ailleurs text;
  v_ma_promo integer; v_sauf text;
  p record; t record; f record; n bigint;
begin
  -- Quelques lignes de plus dans B (propriétaire), pour que les personnages d'ECF aient de quoi ne pas lire.
  perform pg_temp.calcul(format($q$insert into public.settings (key, value, promo_id) values ('preuve_clo', 'B', %s) returning 1$q$, v_pb));
  perform pg_temp.calcul(format($q$insert into public.agenda_events (date_start, title, promo_id) values (current_date, 'Preuve clo agenda B', %s) returning 1$q$, v_pb));
  perform pg_temp.calcul(format($q$insert into public.auto_ecoles (nom, lieu_id) values ('Preuve clo auto-école B', %s) returning 1$q$, v_lb));
  perform pg_temp.calcul(format($q$insert into public.benevoles (prenom, lieu_id) values ('Preuve clo bénévole B', %s) returning 1$q$, v_lb));
  perform pg_temp.calcul(format($q$insert into public.evaluations (stagiaire_id, type, promo_id, note) values (%s, 'Contrôle', %s, 12) returning 1$q$, pg_temp.clo_n('stag_b1'), v_pb));

  -- Le classement : toute table de public classée ou en exception, et rien de classé qui n'existe plus.
  select string_agg(x.tbl, ', ' order by x.tbl) into v_liste
    from (select tablename::text as tbl from pg_tables where schemaname = 'public'
          except select tbl from pg_temp.clo_mat_tables except select tbl from pg_temp.clo_mat_exceptions) x;
  perform pg_temp.attendre('matrice', 'chaque table du schéma public est classée (expression de l''organisme d''une ligne, ou exception justifiée) : tables non classées',
    coalesce(v_liste, 'aucune'), 'aucune');
  select string_agg(x.tbl, ', ' order by x.tbl) into v_liste
    from (select tbl from pg_temp.clo_mat_tables union all select tbl from pg_temp.clo_mat_exceptions
          except select tablename::text from pg_tables where schemaname = 'public') x;
  perform pg_temp.attendre('matrice', 'aucune table classée ou en exception qui n''existe plus', coalesce(v_liste, 'aucune'), 'aucune');
  perform pg_temp.informer('matrice : exceptions', (select string_agg(tbl || ' (' || raison || ')', ' ; ' order by tbl) from pg_temp.clo_mat_exceptions));

  -- Les lignes de chaque organisme, table par table (propriétaire).
  drop table if exists pg_temp.clo_mat_lignes;
  create temp table clo_mat_lignes (tbl text, org text, lignes tid[], primary key (tbl, org));
  for t in select tbl, expr from pg_temp.clo_mat_tables order by tbl loop
    foreach v in array array[v_a, v_b] loop
      begin
        execute format('select coalesce(array_agg(t.ctid), ''{}'') from public.%I t where (%s) = %s', t.tbl, t.expr, v) into v_lignes;
      exception when others then
        v_lignes := null;
      end;
      insert into pg_temp.clo_mat_lignes values (t.tbl, v, v_lignes) on conflict do nothing;
    end loop;
  end loop;
  perform pg_temp.informer('matrice : lignes de B par table', (select string_agg(tbl || '=' || coalesce(cardinality(lignes)::text, 'incalculable'), ', ' order by tbl)
    from pg_temp.clo_mat_lignes where org = v_b and coalesce(cardinality(lignes), -1) <> 0));

  for p in select x.nom, case x.org when 'A' then v_b else v_a end as ailleurs, case x.org when 'A' then v_a else v_b end as chez
             from pg_temp.clo_perso x order by x.org, x.nom loop
    -- Un ancien stagiaire de l'autre organisme (règle 3) garde sa promo de stagiaire et son centre dans ses listes (spec § 5.7 :
    -- son lien de stagiaire reste sur l'ancienne promo) : ces deux lignes-là ne comptent pas.
    begin
      v_ma_promo := (select s.promo_id from public.user_profiles up join public.stagiaires s on s.id = up.stagiaire_id
                      where lower(up.email) = (select lower(x.email) from pg_temp.clo_perso x where x.nom = p.nom)
                        and public.organisme_de_promo(s.promo_id)::text = p.ailleurs limit 1);
    exception when others then
      v_ma_promo := null;
    end;
    -- Lecture : aucune ligne de l'autre organisme.
    v_fuites := null;
    for t in select tbl from pg_temp.clo_mat_tables order by tbl loop
      v_sauf := case when v_ma_promo is null then null
                     when t.tbl = 'promos' then format('t.id = %s', v_ma_promo)
                     when t.tbl = 'lieux' then format('t.id = public.lieu_de_promo(%s)', v_ma_promo) end;
      -- Le profil d'un stagiaire de son propre organisme (un ancien stagiaire devenu personnel de l'autre, règle 3) : lu par l'équipe de
      -- sa promo comme tout stagiaire ; il ne compte pas.
      if t.tbl = 'user_profiles' then
        v_sauf := format('t.stagiaire_id is not null and pg_temp.clo_org_stagiaire(t.stagiaire_id) = %s', p.chez);
      end if;
      v := pg_temp.clo_compter(p.nom, t.tbl, p.ailleurs, v_sauf);
      if v <> '0' then
        v_fuites := concat_ws(', ', v_fuites, t.tbl || ' (' || left(v, 60) || ')');
      end if;
    end loop;
    perform pg_temp.attendre('matrice', format('%s : lecture de chaque table classée, aucune ligne de l''autre organisme%s', p.nom,
      case when v_ma_promo is not null then ' (hors sa promo de stagiaire de l''autre organisme et son centre)' else '' end), coalesce(v_fuites, 'aucune'), 'aucune');
    -- Écriture : modifier ou supprimer une ligne de l'autre organisme ne touche rien (0 ligne, ou refus 42501), sans RETURNING.
    v_ecritures := null;
    for t in select l.tbl, l.lignes from pg_temp.clo_mat_lignes l where l.org = p.ailleurs order by l.tbl loop
      if t.lignes is null then
        v_ecritures := concat_ws(', ', v_ecritures, t.tbl || ' (lignes incalculables)');
        continue;
      end if;
      if cardinality(t.lignes) = 0 then continue; end if;
      select a.attname into v_col from pg_attribute a
       where a.attrelid = ('public.' || quote_ident(t.tbl))::regclass and a.attnum > 0 and not a.attisdropped
         and a.attidentity = '' and a.attgenerated = ''
       order by a.attnum limit 1;
      v := pg_temp.clo_ecrire_annule(p.nom, format('update public.%I t set %I = t.%I where t.ctid = any (%L::tid[])', t.tbl, v_col, v_col, t.lignes));
      if not (v = 'OK 0' or v like 'ERREUR 42501%') then
        v_ecritures := concat_ws(', ', v_ecritures, t.tbl || ' modification (' || left(v, 60) || ')');
      end if;
      v := pg_temp.clo_ecrire_annule(p.nom, format('delete from public.%I t where t.ctid = any (%L::tid[])', t.tbl, t.lignes));
      if not (v = 'OK 0' or v like 'ERREUR 42501%') then
        v_ecritures := concat_ws(', ', v_ecritures, t.tbl || ' suppression (' || left(v, 60) || ')');
      end if;
    end loop;
    perform pg_temp.attendre('matrice', format('%s : modification et suppression des lignes de l''autre organisme, table par table : rien de touché', p.nom), coalesce(v_ecritures, 'aucune'), 'aucune');
    -- Fonctions de lecture de l'inventaire : rien de l'autre organisme (un refus compte pour rien).
    v_fonctions := null;
    for f in select * from (values
        ('mes_promos()', 'select coalesce(array_agg(m.id::text), ''{}'')::text from public.mes_promos() m', 'public.organisme_de_promo(x::integer)'),
        ('comptes_reseau()', 'select coalesce(array_agg(c.lieu_id::text), ''{}'')::text from public.comptes_reseau() c', 'public.organisme_de_lieu(x::integer)'),
        ('roles_du_personnel()', 'select coalesce(array_agg(r.email), ''{}'')::text from public.roles_du_personnel() r', 'pg_temp.clo_org_compte(x)'),
        ('annuaire_centre()', 'select coalesce(array_agg(a.id::text), ''{}'')::text from public.annuaire_centre() a', 'pg_temp.clo_org_contact(x::bigint)'),
        ('ma_fiche_contact() centres', 'select coalesce((select array_agg(c ->> ''id'') from jsonb_array_elements(f -> ''centres'') c), ''{}'')::text from public.ma_fiche_contact() f', 'public.organisme_de_lieu(x::integer)'),
        ('ma_fiche_contact() relais', 'select coalesce((select array_agg(c ->> ''id'') from jsonb_array_elements(f -> ''relais_possibles'') c), ''{}'')::text from public.ma_fiche_contact() f', 'pg_temp.clo_org_contact(x::bigint)'),
        ('titres_visibles(nul)', 'select coalesce(array_agg(t.id::text), ''{}'')::text from public.titres_visibles(null) t', '(select coalesce(ti.organisme_id, public.organisme_de_lieu(ti.lieu_id)) from public.titres ti where ti.id = x::bigint)'),
        ('personnes_et_titres(nul, nul)', 'select coalesce(array_agg(p.email), ''{}'')::text from public.personnes_et_titres(null, null) p', 'pg_temp.clo_org_compte(x)'),
        ('etat_conservation() promos', 'select coalesce((select array_agg(p ->> ''id'') from jsonb_array_elements(e -> ''promos'') p), ''{}'')::text from (select public.etat_conservation() e) z', 'public.organisme_de_promo(x::integer)'),
        ('etat_conservation() portées', 'select coalesce((select array_agg(p ->> ''lieu_id'') from jsonb_array_elements(e -> ''portees_formateurs'') p), ''{}'')::text from (select public.etat_conservation() e) z', 'public.organisme_de_lieu(x::integer)'),
        ('questionnaires_a_remplir()', 'select coalesce(array_agg(coalesce(q.portee ->> ''promo_id'', ''lieu '' || (q.portee ->> ''lieu_id''))), ''{}'')::text from public.questionnaires_a_remplir() q', 'case when x like ''lieu %'' then public.organisme_de_lieu(substr(x, 6)::integer) else public.organisme_de_promo(x::integer) end'),
        ('mon_organisme()', 'select coalesce(array_agg(m.id::text), ''{}'')::text from public.mon_organisme() m', 'x::integer'),
        ('journal_des_droits(nul)', 'select coalesce(array_agg(coalesce(''promo '' || j.promo_id, ''lieu '' || j.lieu_id)), ''{}'')::text from public.journal_des_droits(null) j', 'pg_temp.clo_org_cible(x)')) y(fn, req, org) loop
      v := pg_temp.clo_lire(p.nom, f.req);
      if v like 'OK %' then
        begin
          execute format('select count(*) from unnest(%L::text[]) x where (%s) = %s and x is distinct from %L', substr(v, 4), f.org, p.ailleurs,
            case when f.fn = 'mes_promos()' then v_ma_promo::text end) into n;
          if n > 0 then v_fonctions := concat_ws(', ', v_fonctions, f.fn || ' (' || n || ')'); end if;
        exception when others then
          v_fonctions := concat_ws(', ', v_fonctions, f.fn || ' (incalculable ' || sqlstate || ')');
        end;
      elsif v not like 'ERREUR%' then
        v_fonctions := concat_ws(', ', v_fonctions, f.fn || ' (' || left(v, 60) || ')');
      end if;
    end loop;
    perform pg_temp.attendre('matrice', format('%s : fonctions de lecture de l''inventaire, rien de l''autre organisme', p.nom), coalesce(v_fonctions, 'aucune'), 'aucune');
  end loop;
end $cgm$;

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
  -- Étape 2c : deux personnages de plus (le formateur et le stagiaire d'ECF sans en-tête, règle 4), le classement des tables de la
  -- matrice, puis les groupes ; la matrice en dernier (les groupes précédents ont posé les personnages de la règle 3).
  perform pg_temp.clo_ajouter_perso('form_a_sans', (select email from pg_temp.clo_perso where nom = 'form_a'), 'A', null, 'formateur');
  perform pg_temp.clo_ajouter_perso('stag_a_sans', (select email from pg_temp.clo_perso where nom = 'stag_a'), 'A', null, 'stagiaire');
  perform pg_temp.clo_mat_classement();
  perform pg_temp.groupe_personnel();
  perform pg_temp.groupe_annuaire();
  perform pg_temp.groupe_planning();
  perform pg_temp.groupe_contenus();
  perform pg_temp.groupe_signalements();
  perform pg_temp.groupe_qualite();
  perform pg_temp.groupe_matrice();
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
  -- Règle 6 du contrôleur : le retour 2b joué avec l'étape 2c encore en place est refusé par sa garde, et rien ne change.
  if v_e2c = 'jouée' and v_txt_r2b <> 'select 1' then
    select e.regles || '|' || e.fonctions || '|' || e.droits into v_r from pg_temp.empreinte() e;
    v_r := pg_temp.jouer('retour 2b joué trop tôt', v_txt_r2b) || ' ; '
      || (v_r = (select e.regles || '|' || e.fonctions || '|' || e.droits from pg_temp.empreinte() e))::text;
    perform pg_temp.attendre('retour', 'le retour 2b joué avant celui de l''étape 2c (encore en place) est refusé par sa garde ; empreinte inchangée',
      left(v_r, 36) || right(v_r, 7), 'ERREUR P0001 cloisonnement_2b_retour ; true');
  end if;
  -- Le retour 2c remet l'unicité globale de profs.nom : tant que deux organismes ont une fiche profs du même nom, sa garde le refuse.
  -- Il ne se joue qu'avant la mise en service d'un autre organisme : ici, les noms des fiches des autres organismes sont d'abord
  -- suffixés.
  if v_e2c = 'jouée' and v_txt_r2c <> 'select 1' then
    v_r := pg_temp.jouer('retour 2c joué avec des noms partagés', v_txt_r2c);
    perform pg_temp.attendre('retour', 'le retour 2c joué quand deux organismes ont une fiche profs du même nom est refusé par sa garde',
      left(v_r, 87), 'ERREUR P0001 cloisonnement_2c_retour : deux fiches profs portent le même nom (dans deux');
    perform pg_temp.informer('avant le retour 2c', format('noms suffixés : %s fiche(s) profs d''un autre organisme qu''ECF',
      pg_temp.calcul($q$with m as (update public.profs set nom = nom || ' (organisme ' || organisme_id || ')' where organisme_id <> 1 returning 1) select count(*)::text from m$q$)));
  end if;
  v_r := pg_temp.jouer('retour 2c', v_txt_r2c);
  v_r2c := v_r;
  perform pg_temp.etape('retour 2c', v_r, v_mode);
  if v_e2b = 'jouée' and v_txt_r2a <> 'select 1' then
    v_r := pg_temp.jouer('retour 2a joué trop tôt', v_txt_r2a);
    perform pg_temp.attendre('retour', 'le retour 2a joué avant celui de l''étape 2b (encore en place) est refusé par sa garde',
      left(v_r, 76), 'ERREUR P0001 cloisonnement_2a_retour : une étape plus tardive est en place (');
  end if;
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
    perform pg_temp.attendre('retour', 'après les retours : plus de colonne organisme_id sur registre_qualite ni effacements_journal, profs_nom_key revenue, plus aucune fonction de l''étape 2c',
      pg_temp.calcul($q$select (select count(*) from pg_attribute where attrelid in ('public.registre_qualite'::regclass, 'public.effacements_journal'::regclass)
          and attname = 'organisme_id' and not attisdropped)::text
        || '/' || (select count(*) from pg_constraint where conrelid = 'public.profs'::regclass and conname = 'profs_nom_key')::text
        || '/' || (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('_organisme_unique', '_organisme_ecriture',
             '_organisme_du_personnel', 'organisme_de_compte', '_personnel_ailleurs', '_organisme_redacteur', '_organisme_de_cible', 'compte_dans_mon_organisme',
             'organisme_lisible', 'ressource_ecrivable', 'qcm_signalement_traitable', '_personnel_un_organisme', '_effacements_journal_organisme',
             '_organisme_ligne', 'ligne_lisible', 'effacement_lisible'))::text$q$), '0/1/0');
    perform pg_temp.attendre('retour', 'après les retours : empreinte regles identique à celle d''avant', v_ap_regles, v_av_regles);
    perform pg_temp.attendre('retour', 'après les retours : empreinte fonctions identique à celle d''avant', v_ap_fonctions, v_av_fonctions);
    perform pg_temp.attendre('retour', 'après les retours : empreinte droits identique à celle d''avant', v_ap_droits, v_av_droits);
  end if;
  perform pg_temp.informer('durée du bloc', to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0') || ' s');
  perform pg_temp.verdict_titres(v_mode, v_debut);
  raise exception 'la preuve doit finir par la levée du verdict';
end $clopreuve$;
