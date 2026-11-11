-- Preuve du chantier « titres et droits à la carte » : ce que chaque migration 20261112_titres_<n> doit donner, écrite avec elle.
--   structure   chaque migration injectée se joue sans erreur ; chaque retour aussi.
--   titres      (migration 1) trois titres fixes, un par niveau ; chaque affectation porte le titre fixe de son niveau ; plafonds
--               des pages ; _cases_valides (valeurs, plafonds, Réglages, noms de stagiaires § 5.4) ; contraintes de la table ;
--               unicité du nom par portée (casse ignorée) ; aucun droit pour anon ni authenticated.
--   affectation (migration 1) le déclencheur : titre fixe posé d'office, niveau, centre et « un titre de promo par centre ».
--   retour      les retours défont tout, dans l'ordre inverse (4, 3, 2, 1) : l'empreinte (règles, fonctions, droits) égale celle d'avant.
-- Les groupes des migrations 2 à 4 s'ajoutent ici, avec leurs tâches.
-- GABARIT, à ne pas jouer tel quel : outils/assembler_repetition_roles.mjs y colle les aides communes (tests/sql/roles-aides.sql),
-- le libellé du mode, la requête d'empreinte, puis les migrations 1 à 4 et leurs retours :
--   node outils/assembler_repetition_roles.mjs titres [--etapes 1,2] <sortie.sql>   les étapes dont les fichiers existent
--                                                                                   (ou celles demandées) : VERT attendu
--   node outils/assembler_repetition_roles.mjs titres-contre-epreuve <sortie.sql>   sans aucune migration : ROUGE attendu sur
--                                                                                   chaque contrôle du groupe titres
--   node outils/assembler_repetition_roles.mjs titres-en-ligne <sortie.sql>         rien d'injecté, après application réelle
-- À jouer APRÈS la suite du lot 5 (jusqu'à 20261111_espaces_4_donnees). Le fichier assemblé se joue en une requête ; le bloc do
-- finit TOUJOURS par une levée : migrations, personnages et lignes d'essai sont annulés, rien ne reste.

-- @@INCLURE tests/sql/roles-aides.sql@@

create or replace function pg_temp.empreinte(out regles text, out fonctions text, out droits text)
language plpgsql as $temp$
begin
  execute
-- @@INJECTER tests/sql/roles-empreinte.sql@@
  into regles, fonctions, droits;
end $temp$;

-- Une migration ou un retour, joué tel quel dans une sous-transaction : « jouée », « neutralisée » (le littéral 'select 1'
-- que l'assembleur met à la place d'un fichier non injecté), ou l'erreur (état SQL, jamais le message).
create or replace function pg_temp.jouer(p_nom text, p_sql text)
returns text language plpgsql as $tj$
begin
  if p_sql = 'select 1' then return 'neutralisée'; end if;
  perform pg_temp.informer(format('md5 du texte joué : %s', p_nom), md5(p_sql));
  begin
    execute p_sql;
    return 'jouée';
  exception when others then
    return 'ERREUR ' || sqlstate;
  end;
end $tj$;

-- Le sort d'une migration ou d'un retour : une information si elle est neutralisée, sinon un contrôle de la structure.
create or replace function pg_temp.etape(p_nom text, p_etat text, p_mode text)
returns void language plpgsql as $te$
begin
  if p_etat = 'neutralisée' then
    perform pg_temp.informer(p_nom, 'non injecté (' || p_mode || ')');
  else
    perform pg_temp.verifier('structure', p_nom || ' jouée sans erreur', p_etat = 'jouée', p_etat);
  end if;
end $te$;

-- Un ordre jeté en propriétaire : « OK » ou « ERREUR <état> ». Ce que l'ordre a réussi reste fait (la preuve annule tout à la fin).
create or replace function pg_temp.essai(p_sql text)
returns text language plpgsql as $tes$
begin
  perform pg_temp.proprio();
  execute p_sql;
  return 'OK';
exception when others then
  return 'ERREUR ' || sqlstate;
end $tes$;

-- Un titre créé en propriétaire : son identifiant en texte, ou « incalculable (...) ».
create or replace function pg_temp.nouveau_titre(p_nom text, p_niveau text, p_lieu integer)
returns text language sql as $tn$
  select pg_temp.calcul(format('insert into public.titres (nom, niveau, lieu_id, cases, cree_par) values (%L, %L, %s, ''{}'', ''preuve'') returning id::text',
    p_nom, p_niveau, coalesce(p_lieu::text, 'null')));
$tn$;

-- Une ligne d'affectation posée en propriétaire. p_titre est le texte d'un identifiant (ou 'null' pour un titre nul explicite),
-- ou nul pour ne pas citer la colonne. Rend « OK » ou « ERREUR <état> ».
create or replace function pg_temp.affecter(p_email text, p_role text, p_promo integer, p_lieu integer, p_titre text)
returns text language sql as $ta$
  select pg_temp.essai(format('insert into public.affectations (email, role, promo_id, lieu_id%s) values (%L, %L, %s, %s%s)',
    case when p_titre is null then '' else ', titre_id' end, p_email, p_role,
    coalesce(p_promo::text, 'null'), coalesce(p_lieu::text, 'null'), case when p_titre is null then '' else ', ' || p_titre end));
$ta$;

-- Un jeu de cases jugé par _cases_valides : vrai ou faux attendu.
create or replace function pg_temp.cases(p_niveau text, p_json text, p_attendu boolean)
returns void language sql as $tc$
  select pg_temp.attendre('cases', format('_cases_valides(%s, %s)', p_niveau, p_json),
    pg_temp.calcul(format('select public._cases_valides(%L, %L::jsonb)::text', p_niveau, p_json)), p_attendu::text);
$tc$;

-- Verdict : lève TOUJOURS une exception, qui annule tout. Les échecs d'abord, puis les comptes par groupe, puis chaque contrôle réussi.
create or replace function pg_temp.verdict_titres(p_mode text, p_debut timestamptz)
returns void language plpgsql as $tv$
declare v_ok integer; v_ko integer; v_groupes text; v_echecs text; v_reussis text; v_infos text; v_msg text; v_duree text;
begin
  v_duree := to_char(extract(epoch from clock_timestamp() - p_debut), 'FM990.0') || ' s';
  select count(*) filter (where etat = 'ok'), count(*) filter (where etat = 'échec') into v_ok, v_ko from preuve;
  select string_agg(format('%s %s/%s', groupe, ok, n), ' ; ' order by premier) into v_groupes
    from (select groupe, count(*) as n, count(*) filter (where etat = 'ok') as ok, min(num) as premier
            from preuve where etat <> 'info' group by groupe) g;
  select string_agg(format('- [%s] %s', groupe, libelle) || coalesce(' : ' || nullif(left(detail, 200), ''), ''), E'\n' order by num)
    into v_echecs from preuve where etat = 'échec';
  select string_agg(format('- [%s] %s', groupe, libelle), E'\n' order by num) into v_reussis from preuve where etat = 'ok';
  select string_agg('- ' || libelle || coalesce(' : ' || nullif(detail, ''), ''), E'\n' order by num) into v_infos
    from preuve where etat = 'info';
  if v_ko = 0 and v_ok > 0 then
    v_msg := format(E'VERT %s/0 (tout est annulé) ; mode %s ; durée %s\npar groupe (réussis/joués) : %s\ncontrôles :\n%s',
      v_ok, p_mode, v_duree, v_groupes, coalesce(v_reussis, '- aucun'));
  else
    v_msg := format(E'ROUGE %s/%s (tout est annulé) ; mode %s ; durée %s\néchecs d''abord :\n%s\npar groupe (réussis/joués) : %s\ncontrôles réussis :\n%s',
      v_ok, v_ko, p_mode, v_duree, coalesce(v_echecs, '- aucun'), coalesce(v_groupes, 'aucun contrôle joué'),
      coalesce(v_reussis, '- aucun'));
  end if;
  if v_infos is not null then
    v_msg := v_msg || E'\nà titre d''information (jamais compté) :\n' || v_infos;
  end if;
  raise exception using message = v_msg;
end $tv$;

do $tprv$
declare
  v_mode constant text :=
-- @@MODE@@
  ;
  v_debut constant timestamptz := clock_timestamp();
  c_a constant text := 'preuve7.form.a@exemple.invalid';
  c_b constant text := 'preuve7.form.b@exemple.invalid';
  c_c constant text := 'preuve7.form.c@exemple.invalid';
  c_dir constant text := 'preuve7.dir.un@exemple.invalid';
  c_dir2 constant text := 'preuve7.dir.deux@exemple.invalid';
  c_siege constant text := 'preuve7.siege@exemple.invalid';
  c_auth constant text := 'preuve7.compte@exemple.invalid';
  v_pa constant integer := 990701; v_pb constant integer := 990702; v_pc constant integer := 990703;
  v_en_ligne boolean;
  v_etat text; v_etat1 text; v_retour text; v_retour1 text;
  v_av_regles text; v_av_fonctions text; v_av_droits text;
  v_ap_regles text; v_ap_fonctions text; v_ap_droits text;
  v_lieu1 integer; v_lieu2 integer;
  s_form constant text := 'preuve7.seed.form@exemple.invalid';
  s_dir constant text := 'preuve7.seed.dir@exemple.invalid';
  s_siege constant text := 'preuve7.seed.siege@exemple.invalid';
  c_x constant text := 'preuve7.form.x@exemple.invalid';
  v_n_juge text;
  v_c1 text; v_c2 text; v_p1 text; v_p2 text; v_r1 text; v_x text;
begin
  perform set_config('lock_timeout', '3s', true);
  v_en_ligne := v_mode like 'titres-en-ligne%';

  -- 1. Avant les migrations : empreinte de la base, centres des promos 1 et 2.
  select e.regles, e.fonctions, e.droits into v_av_regles, v_av_fonctions, v_av_droits from pg_temp.empreinte() e;
  v_lieu1 := (select lieu_id from public.promos where id = 1);
  v_lieu2 := (select lieu_id from public.promos where id = 2);
  perform pg_temp.verifier('structure', 'les promos 1 et 2 sont dans deux centres différents',
    v_lieu1 is not null and v_lieu2 is not null and v_lieu1 <> v_lieu2,
    format('centres des promos 1 et 2 : %s et %s', coalesce(v_lieu1::text, 'nul'), coalesce(v_lieu2::text, 'nul')));

  -- 1 bis. Des lignes d'affectation d'avant la migration (un formateur, une direction, un siège) : le remplissage se juge sur elles.
  insert into public.promos (id, lieu_id, nom, date_debut, date_fin) values
    (v_pa, v_lieu1, 'Preuve7 promo A', current_date - 20, null),
    (v_pb, v_lieu1, 'Preuve7 promo B', current_date - 20, null),
    (v_pc, v_lieu2, 'Preuve7 promo C', current_date - 20, null);
  insert into public.user_profiles (email, role, is_admin, stagiaire_id, prof_id) values
    (s_form, 'prof', true, null, null), (s_dir, 'prof', false, null, null), (s_siege, 'prof', false, null, null);
  insert into public.affectations (email, role, promo_id, lieu_id) values
    (s_form, 'formateur', v_pa, null), (s_dir, 'direction', null, v_lieu1), (s_siege, 'siege', null, null);

  -- 2. Les migrations, dans l'ordre (neutralisées dans les modes sans elles).
  v_etat := pg_temp.jouer('migration 1',
-- @@INJECTER supabase/migrations/20261112_titres_1_tables.sql@@
  );
  v_etat1 := v_etat;
  perform pg_temp.etape('migration 1', v_etat, v_mode);
  v_etat := pg_temp.jouer('migration 2',
-- @@INJECTER supabase/migrations/20261112_titres_2_fonctions.sql@@
  );
  perform pg_temp.etape('migration 2', v_etat, v_mode);
  v_etat := pg_temp.jouer('migration 3',
-- @@INJECTER supabase/migrations/20261112_titres_3_gestes.sql@@
  );
  perform pg_temp.etape('migration 3', v_etat, v_mode);
  v_etat := pg_temp.jouer('migration 4',
-- @@INJECTER supabase/migrations/20261112_titres_4_regles.sql@@
  );
  perform pg_temp.etape('migration 4', v_etat, v_mode);

  -- 3. Groupe titres : les lignes que la migration 1 pose d'elle-même, avant tout essai.
  perform pg_temp.attendre('titres', 'trois titres fixes, un par niveau',
    pg_temp.calcul($q$select string_agg(niveau || ':' || nom, ',' order by niveau collate "C") from public.titres where fixe$q$),
    'centre:Direction de centre,promo:Formateur,reseau:Siège');
  perform pg_temp.attendre('titres', 'chaque affectation porte le titre fixe de son niveau',
    pg_temp.calcul($q$select count(*)::text from public.affectations a join public.titres t on t.id = a.titre_id where not t.fixe or t.niveau <> case a.role when 'formateur' then 'promo' when 'direction' then 'centre' else 'reseau' end$q$), '0');
  perform pg_temp.attendre('titres', 'le remplissage, ligne à ligne : le formateur, la direction et le siège d''avant la migration ont le titre de leur niveau',
    pg_temp.calcul(format('select string_agg(a.email || ''>'' || t.nom, '','' order by a.email collate "C") from public.affectations a join public.titres t on t.id = a.titre_id where a.email in (%L, %L, %L)', s_form, s_dir, s_siege)),
    format('%s>Direction de centre,%s>Formateur,%s>Siège', s_dir, s_form, s_siege));
  v_n_juge := pg_temp.calcul($q$select count(*)::text from public.affectations a join public.titres t on t.id = a.titre_id where t.fixe and t.niveau = case a.role when 'formateur' then 'promo' when 'direction' then 'centre' else 'reseau' end$q$);
  perform pg_temp.informer('lignes d''affectation jugées (titre fixe de leur niveau)', v_n_juge);
  perform pg_temp.attendre('titres', 'au moins trois lignes jugées (une de chaque rôle), jamais un contrôle à vide',
    (v_n_juge ~ '^[0-9]+$' and v_n_juge::integer >= 3)::text, 'true');
  perform pg_temp.attendre('titres', 'aucune affectation sans titre',
    pg_temp.calcul($q$select count(*)::text from public.affectations where titre_id is null$q$), '0');
  perform pg_temp.attendre('titres', 'les titres fixes ont des cases vides, aucun centre, la marque de la migration',
    pg_temp.calcul($q$select string_agg(distinct (cases = '{}'::jsonb)::text || '/' || coalesce(lieu_id::text, 'sans') || '/' || cree_par, ',') from public.titres where fixe$q$),
    'true/sans/migration 20261112_titres_1');
  perform pg_temp.attendre('titres', 'les pages du niveau promo (nombre)',
    pg_temp.calcul($q$select count(*)::text from public._pages_du_niveau('promo')$q$), '8');
  perform pg_temp.attendre('titres', 'les pages du niveau centre (nombre)',
    pg_temp.calcul($q$select count(*)::text from public._pages_du_niveau('centre')$q$), '6');
  perform pg_temp.attendre('titres', 'les pages du niveau reseau (nombre)',
    pg_temp.calcul($q$select count(*)::text from public._pages_du_niveau('reseau')$q$), '3');
  perform pg_temp.attendre('titres', 'plafonds du niveau promo',
    pg_temp.calcul($q$select string_agg(page || ':' || plafond, ',' order by page collate "C") from public._pages_du_niveau('promo')$q$),
    'ccp2:1,cours:2,emargement:2,indicateurs:1,notes:2,planning:2,reglages:2,stagiaires:2');
  perform pg_temp.attendre('titres', 'plafonds du niveau centre',
    pg_temp.calcul($q$select string_agg(page || ':' || plafond, ',' order by page collate "C") from public._pages_du_niveau('centre')$q$),
    'emargement:1,equipe:2,notes:1,promos:2,reglages:2,stagiaires:2');
  perform pg_temp.attendre('titres', 'plafonds du niveau reseau',
    pg_temp.calcul($q$select string_agg(page || ':' || plafond, ',' order by page collate "C") from public._pages_du_niveau('reseau')$q$),
    'cours:2,directions:2,reglages:2');
  perform pg_temp.attendre('titres', 'un niveau inconnu n''a aucune page',
    pg_temp.calcul($q$select count(*)::text from public._pages_du_niveau('autre')$q$), '0');

  -- 4. Groupe cases : _cases_valides.
  perform pg_temp.cases('promo', '{}', true);
  perform pg_temp.cases('promo', '{"notes":"voir"}', false);
  perform pg_temp.cases('promo', '{"notes":"voir","stagiaires":"voir"}', true);
  perform pg_temp.cases('promo', '{"planning":"modifier","stagiaires":"voir"}', true);
  perform pg_temp.cases('promo', '{"emargement":"voir"}', false);
  perform pg_temp.cases('promo', '{"indicateurs":"voir"}', false);
  perform pg_temp.cases('promo', '{"indicateurs":"voir","stagiaires":"non"}', false);
  perform pg_temp.cases('promo', '{"cours":"modifier"}', true);
  perform pg_temp.cases('promo', '{"ccp2":"voir"}', true);
  perform pg_temp.cases('promo', '{"ccp2":"modifier"}', false);
  perform pg_temp.cases('promo', '{"indicateurs":"modifier","stagiaires":"voir"}', false);
  perform pg_temp.cases('promo', '{"reglages":"voir"}', false);
  perform pg_temp.cases('promo', '{"reglages":"modifier"}', true);
  perform pg_temp.cases('promo', '{"reglages":"non"}', true);
  perform pg_temp.cases('promo', '{"inconnue":"voir"}', false);
  perform pg_temp.cases('promo', '{"cours":"peut-etre"}', false);
  perform pg_temp.cases('promo', '{"cours":2}', false);
  perform pg_temp.cases('promo', '[]', false);
  perform pg_temp.cases('promo', '"voir"', false);
  perform pg_temp.cases('centre', '{"emargement":"voir"}', false);
  perform pg_temp.cases('centre', '{"emargement":"voir","stagiaires":"voir"}', true);
  perform pg_temp.cases('centre', '{"notes":"voir","stagiaires":"modifier"}', true);
  perform pg_temp.cases('centre', '{"emargement":"modifier","stagiaires":"voir"}', false);
  perform pg_temp.cases('centre', '{"notes":"modifier","stagiaires":"voir"}', false);
  perform pg_temp.cases('centre', '{"promos":"modifier","equipe":"voir"}', true);
  perform pg_temp.cases('centre', '{"planning":"voir"}', false);
  perform pg_temp.cases('centre', '{"reglages":"voir"}', false);
  perform pg_temp.cases('reseau', '{"cours":"modifier","directions":"voir","reglages":"modifier"}', true);
  perform pg_temp.cases('reseau', '{"stagiaires":"voir"}', false);
  perform pg_temp.cases('reseau', '{"reglages":"voir"}', false);
  perform pg_temp.cases('autre', '{}', false);

  -- 5. Personnages d'essai, en propriétaire.
  insert into public.user_profiles (email, role, is_admin, stagiaire_id, prof_id) values
    (c_x, 'prof', true, null, null), (c_a, 'prof', true, null, null), (c_b, 'prof', true, null, null), (c_c, 'prof', true, null, null),
    (c_dir, 'prof', false, null, null), (c_dir2, 'prof', false, null, null), (c_siege, 'prof', false, null, null),
    (c_auth, 'prof', false, null, null);

  -- 6. Groupe titres, suite : les contraintes de la table et l'unicité des noms.
  v_r1 := pg_temp.nouveau_titre('Preuve7 Qualité', 'reseau', null);
  v_c1 := pg_temp.nouveau_titre('Preuve7 centre un', 'centre', v_lieu1);
  v_c2 := pg_temp.nouveau_titre('Preuve7 centre deux', 'centre', v_lieu2);
  v_p1 := pg_temp.nouveau_titre('Preuve7 promo un', 'promo', v_lieu1);
  v_p2 := pg_temp.nouveau_titre('Preuve7 promo deux', 'promo', v_lieu1);
  perform pg_temp.attendre('titres', 'cinq titres d''essai créés (un du réseau, deux de centre, deux de promo)',
    (select count(*)::text from unnest(array[v_r1, v_c1, v_c2, v_p1, v_p2]) x where x ~ '^[0-9]+$'), '5');
  perform pg_temp.attendre('titres', 'deux titres du réseau « Qualité » et « qualité » : refusé (23505)',
    pg_temp.essai($q$insert into public.titres (nom, niveau) values ('Preuve7 qualité', 'reseau')$q$), 'ERREUR 23505');
  perform pg_temp.attendre('titres', 'un titre de centre du même nom qu''un titre du réseau : permis',
    pg_temp.essai($q$insert into public.titres (nom, niveau, lieu_id) values ('PREUVE7 QUALITÉ', 'centre', $q$ || v_lieu1 || ')'), 'OK');
  perform pg_temp.attendre('titres', 'le même nom dans deux centres : permis',
    pg_temp.essai(format('insert into public.titres (nom, niveau, lieu_id) values (''Preuve7 commun'', ''promo'', %s), (''Preuve7 commun'', ''promo'', %s)', v_lieu1, v_lieu2)), 'OK');
  perform pg_temp.attendre('titres', 'le même nom (casse ignorée) deux fois dans un centre : refusé (23505)',
    pg_temp.essai(format('insert into public.titres (nom, niveau, lieu_id) values (''preuve7 COMMUN'', ''promo'', %s)', v_lieu1)), 'ERREUR 23505');
  perform pg_temp.attendre('titres', 'un second titre fixe dans un niveau : refusé (23505)',
    pg_temp.essai($q$insert into public.titres (nom, niveau, fixe) values ('Preuve7 autre fixe', 'promo', true)$q$), 'ERREUR 23505');
  perform pg_temp.attendre('titres', 'un titre fixe rattaché à un centre : refusé (23514)',
    pg_temp.essai(format('insert into public.titres (nom, niveau, fixe, lieu_id) values (''Preuve7 fixe centre'', ''centre'', true, %s)', v_lieu1)), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'un titre du réseau rattaché à un centre : refusé (23514)',
    pg_temp.essai(format('insert into public.titres (nom, niveau, lieu_id) values (''Preuve7 reseau centre'', ''reseau'', %s)', v_lieu1)), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'une origine sur un titre sans centre : refusé (23514)',
    pg_temp.essai(format('insert into public.titres (nom, niveau, origine_id) values (''Preuve7 origine'', ''reseau'', %s)', coalesce(v_r1, 'null'))), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'la version d''un centre d''un titre du réseau (origine + centre) : permise',
    pg_temp.essai(format('insert into public.titres (nom, niveau, lieu_id, origine_id) values (''Preuve7 version'', ''centre'', %s, %s)', v_lieu1, coalesce(v_r1, 'null'))), 'OK');
  perform pg_temp.attendre('titres', 'un niveau inconnu : refusé (23514)',
    pg_temp.essai($q$insert into public.titres (nom, niveau) values ('Preuve7 niveau', 'autre')$q$), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'des cases inadmissibles (page inconnue) : refusées (23514)',
    pg_temp.essai($q$insert into public.titres (nom, niveau, cases) values ('Preuve7 cases', 'reseau', '{"inconnue":"voir"}')$q$), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'des cases qui trahissent § 5.4 : refusées (23514)',
    pg_temp.essai(format('insert into public.titres (nom, niveau, lieu_id, cases) values (''Preuve7 cases deux'', ''promo'', %s, ''{"notes":"voir"}'')', v_lieu1)), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'des cases admissibles : permises',
    pg_temp.essai(format('insert into public.titres (nom, niveau, lieu_id, cases) values (''Preuve7 cases trois'', ''promo'', %s, ''{"notes":"voir","stagiaires":"voir"}'')', v_lieu1)), 'OK');
  perform pg_temp.attendre('titres', 'un titre non fixe de promo sans centre : refusé (23514)',
    pg_temp.essai($q$insert into public.titres (nom, niveau) values ('Preuve7 promo sans centre', 'promo')$q$), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'un titre non fixe de centre sans centre : refusé (23514)',
    pg_temp.essai($q$insert into public.titres (nom, niveau) values ('Preuve7 centre sans centre', 'centre')$q$), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'des cases modifiées en cases inadmissibles : refusées (23514)',
    pg_temp.essai($q$update public.titres set cases = '{"ccp2":"modifier"}' where nom = 'Preuve7 cases trois'$q$), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'supprimer le titre d''origine laisse la version du centre sans origine',
    pg_temp.essai(format('delete from public.titres where id = %s', coalesce(v_r1, '0'))) || ' ' ||
    pg_temp.calcul($q$select count(*)::text from public.titres where nom = 'Preuve7 version' and origine_id is null$q$), 'OK 1');

  -- 7. Groupe affectation : le déclencheur.
  perform pg_temp.attendre('affectation', 'un ajout en propriétaire sans titre_id reçoit le titre fixe de promo (formateur)',
    pg_temp.calcul(format('insert into public.affectations (email, role, promo_id) values (%L, ''formateur'', %s) returning (titre_id = public.titre_fixe(''promo''))::text', c_a, v_pa)), 'true');
  perform pg_temp.attendre('affectation', 'un ajout sans titre_id reçoit le titre fixe de centre (direction)',
    pg_temp.calcul(format('insert into public.affectations (email, role, lieu_id) values (%L, ''direction'', %s) returning (titre_id = public.titre_fixe(''centre''))::text', c_dir, v_lieu1)), 'true');
  perform pg_temp.attendre('affectation', 'un ajout sans titre_id reçoit le titre fixe du réseau (siège)',
    pg_temp.calcul(format('insert into public.affectations (email, role) values (%L, ''siege'') returning (titre_id = public.titre_fixe(''reseau''))::text', c_siege)), 'true');
  perform pg_temp.attendre('affectation', 'un titre_id nul cité explicitement reçoit aussi le titre fixe',
    pg_temp.calcul(format('insert into public.affectations (email, role, promo_id, titre_id) values (%L, ''formateur'', %s, null) returning (titre_id = public.titre_fixe(''promo''))::text', c_b, v_pb)), 'true');
  perform pg_temp.attendre('affectation', 'après ces ajouts, chaque affectation porte encore le titre fixe de son niveau',
    pg_temp.calcul($q$select count(*)::text from public.affectations a join public.titres t on t.id = a.titre_id where not t.fixe or t.niveau <> case a.role when 'formateur' then 'promo' when 'direction' then 'centre' else 'reseau' end$q$), '0');
  perform pg_temp.attendre('affectation', 'un titre de niveau centre sur une ligne formateur : refusé (23514)',
    pg_temp.affecter(c_c, 'formateur', v_pa, null, v_c1), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'un titre de niveau promo sur une ligne direction : refusé (23514)',
    pg_temp.affecter(c_dir2, 'direction', null, v_lieu2, v_p1), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'un titre de centre d''un autre centre : refusé (23514)',
    pg_temp.affecter(c_dir2, 'direction', null, v_lieu2, v_c1), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'le titre du bon centre : permis',
    pg_temp.affecter(c_dir2, 'direction', null, v_lieu2, v_c2), 'OK');
  perform pg_temp.attendre('affectation', 'un titre de promo d''un autre centre que celui de la promo : refusé (23514)',
    pg_temp.affecter(c_c, 'formateur', v_pc, null, v_p1), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'un titre de centre sur une ligne siège : refusé (23514)',
    pg_temp.affecter(c_auth, 'siege', null, null, v_c1), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'un titre de promo (non fixe) sur une première promo : permis',
    pg_temp.affecter(c_c, 'formateur', v_pa, null, v_p1), 'OK');
  perform pg_temp.attendre('affectation', 'un autre titre de promo dans le même centre : refusé (23514)',
    pg_temp.affecter(c_c, 'formateur', v_pb, null, v_p2), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'le titre fixe, qui est un autre titre de promo, dans le même centre : refusé (23514)',
    pg_temp.affecter(c_c, 'formateur', v_pb, null, 'public.titre_fixe(''promo'')'), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'le même titre sur une seconde promo du centre : permis',
    pg_temp.affecter(c_c, 'formateur', v_pb, null, v_p1), 'OK');
  perform pg_temp.attendre('affectation', 'une ligne dans un autre centre, sans titre cité : permise, avec le titre fixe',
    pg_temp.affecter(c_c, 'formateur', v_pc, null, null) || ' ' ||
    pg_temp.calcul(format('select (titre_id = public.titre_fixe(''promo''))::text from public.affectations where lower(email) = %L and promo_id = %s', c_c, v_pc)), 'OK true');
  perform pg_temp.attendre('affectation', 'la même adresse écrite en majuscules compte pour la même personne : refusé (23514)',
    pg_temp.affecter(upper(c_c), 'formateur', v_pb, null, v_p2), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'changer le titre d''une ligne alors qu''une autre ligne du centre garde l''ancien : refusé (23514)',
    pg_temp.essai(format('update public.affectations set titre_id = %s where lower(email) = %L and promo_id = %s', coalesce(v_p2, 'null'), c_c, v_pa)), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'retirer l''autre ligne du centre, puis changer le titre de la dernière : permis',
    pg_temp.essai(format('delete from public.affectations where lower(email) = %L and promo_id = %s', c_c, v_pb)) || ' ' ||
    pg_temp.essai(format('update public.affectations set titre_id = %s where lower(email) = %L and promo_id = %s', coalesce(v_p2, 'null'), c_c, v_pa)), 'OK OK');
  perform pg_temp.attendre('affectation', 'une ligne dont l''adresse change vers une personne qui a déjà un autre titre de promo dans le centre : refusé (23514)',
    pg_temp.affecter(c_x, 'formateur', v_pb, null, null) || ' ' ||
    pg_temp.essai(format('update public.affectations set email = %L where email = %L', c_c, c_x)), 'OK ERREUR 23514');
  perform pg_temp.attendre('affectation', 'une promo changée vers un autre centre avec un titre du premier centre : refusé (23514)',
    pg_temp.essai(format('update public.affectations set promo_id = %s where lower(email) = %L and promo_id = %s', v_pc, c_c, v_pa)), 'ERREUR 23514');
  perform pg_temp.attendre('affectation', 'un titre qui n''existe pas : refusé par la clé étrangère (23503)',
    pg_temp.affecter(c_auth, 'formateur', v_pa, null, '999999999'), 'ERREUR 23503');
  perform pg_temp.attendre('affectation', 'supprimer un titre encore porté : refusé (23001, restrict)',
    pg_temp.essai(format('delete from public.titres where id = %s', coalesce(v_p2, '0'))), 'ERREUR 23001');
  perform pg_temp.attendre('affectation', 'supprimer un titre fixe encore porté : refusé (23001, restrict)',
    pg_temp.essai($q$delete from public.titres where fixe and niveau = 'promo'$q$), 'ERREUR 23001');

  -- 7 bis. Un titre porté (ou fixe) ne change ni de niveau, ni de centre, ni de caractère fixe.
  perform pg_temp.attendre('titres', 'titre porté : changer son niveau est refusé (23514)',
    pg_temp.essai(format('update public.titres set niveau = ''centre'' where id = %s', coalesce(v_p2, '0'))), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'titre porté : changer son centre est refusé (23514)',
    pg_temp.essai(format('update public.titres set lieu_id = %s where id = %s', v_lieu2, coalesce(v_p2, '0'))), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'titre porté : le rendre fixe est refusé (23514)',
    pg_temp.essai(format('update public.titres set fixe = true, lieu_id = null where id = %s', coalesce(v_p2, '0'))), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'titre fixe : changer son niveau est refusé (23514)',
    pg_temp.essai($q$update public.titres set niveau = 'reseau' where fixe and niveau = 'promo'$q$), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'titre fixe : le rendre non fixe est refusé (23514)',
    pg_temp.essai($q$update public.titres set fixe = false where fixe and niveau = 'centre'$q$), 'ERREUR 23514');
  perform pg_temp.attendre('titres', 'titre porté : le nom et les cases se modifient (OK OK)',
    pg_temp.essai(format('update public.titres set nom = ''Preuve7 promo deux bis'' where id = %s', coalesce(v_p2, '0'))) || ' ' ||
    pg_temp.essai(format('update public.titres set cases = ''{"cours":"voir"}'' where id = %s', coalesce(v_p2, '0'))), 'OK OK');
  perform pg_temp.attendre('titres', 'titre non porté : son centre peut changer',
    pg_temp.essai(format('update public.titres set lieu_id = %s where id = %s', v_lieu2, coalesce(v_c1, '0'))), 'OK');

  -- 8. Groupe droits : aucun accès direct aux titres, jamais de titre_id choisi par un client.
  perform pg_temp.attendre('droits', 'authenticated ne lit pas titres (42501)',
    pg_temp.valeur(c_auth, null, null, 'select count(*)::text from public.titres'), 'ERREUR 42501');
  perform pg_temp.attendre('droits', 'anon ne lit pas titres (42501)',
    pg_temp.valeur(null, null, null, 'select count(*)::text from public.titres'), 'ERREUR 42501');
  perform pg_temp.attendre('droits', 'authenticated n''écrit pas dans titres (42501)',
    pg_temp.valeur(c_auth, null, null, $q$insert into public.titres (nom, niveau) values ('Preuve7 client', 'reseau') returning id::text$q$), 'ERREUR 42501');
  perform pg_temp.attendre('droits', 'anon n''écrit pas dans titres (42501)',
    pg_temp.valeur(null, null, null, $q$insert into public.titres (nom, niveau) values ('Preuve7 anonyme', 'reseau') returning id::text$q$), 'ERREUR 42501');
  perform pg_temp.attendre('droits', 'authenticated ne modifie ni ne supprime les titres (42501)',
    pg_temp.valeur(c_auth, null, null, $q$update public.titres set nom = 'x' returning id::text$q$) || ' ' ||
    pg_temp.valeur(c_auth, null, null, $q$delete from public.titres returning id::text$q$), 'ERREUR 42501 ERREUR 42501');
  perform pg_temp.attendre('droits', 'aucun droit de table sur titres pour anon ni authenticated (PUBLIC compris, par héritage)',
    pg_temp.calcul($q$select count(*)::text from (select unnest(array['select','insert','update','delete','truncate','references','trigger']) p) x, unnest(array['anon','authenticated']) r where has_table_privilege(r, 'public.titres', x.p)$q$), '0');
  perform pg_temp.attendre('droits', 'authenticated n''insère pas titre_id dans affectations (droit de colonne)',
    pg_temp.calcul($q$select has_column_privilege('authenticated', 'public.affectations', 'titre_id', 'insert')::text$q$), 'false');
  perform pg_temp.attendre('droits', 'anon n''insère pas titre_id dans affectations (droit de colonne)',
    pg_temp.calcul($q$select has_column_privilege('anon', 'public.affectations', 'titre_id', 'insert')::text$q$), 'false');
  perform pg_temp.attendre('droits', 'un client qui cite titre_id à l''ajout : refusé (42501)',
    pg_temp.valeur(c_auth, null, null, format('insert into public.affectations (email, role, promo_id, titre_id) values (%L, ''formateur'', %s, 1) returning id::text', c_auth, v_pa)), 'ERREUR 42501');
  perform pg_temp.attendre('droits', 'le droit d''insertion par colonne des affectations garde ses quatre colonnes',
    pg_temp.calcul($q$select string_agg(a.attname, ',' order by a.attname collate "C") from pg_attribute a where a.attrelid = 'public.affectations'::regclass and a.attnum > 0 and not a.attisdropped and has_column_privilege('authenticated', a.attrelid, a.attnum, 'insert')$q$),
    'email,lieu_id,promo_id,role');
  perform pg_temp.attendre('droits', 'titres : sécurité par ligne active, et aucune règle (la lecture passera par des fonctions)',
    pg_temp.calcul($q$select (c.relrowsecurity and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = 'titres'))::text from pg_class c where c.oid = 'public.titres'::regclass$q$), 'true');
  perform pg_temp.attendre('droits', 'les cinq fonctions de la migration 1 n''ont aucun droit d''exécution pour anon ni authenticated',
    pg_temp.calcul($q$select count(*)::text from unnest(array['public._pages_du_niveau(text)', 'public._cases_valides(text, jsonb)', 'public.titre_fixe(text)', 'public._affectations_titre()', 'public._titres_stable()']) f, unnest(array['anon','authenticated']) r where has_function_privilege(r, f, 'execute')$q$), '0');

  -- 9. Les retours, dans l'ordre inverse (4, 3, 2, 1).
  v_retour := pg_temp.jouer('retour 4',
-- @@INJECTER supabase/migrations/20261112_titres_4_regles_retour.sql@@
  );
  perform pg_temp.etape('retour 4', v_retour, v_mode);
  v_retour := pg_temp.jouer('retour 3',
-- @@INJECTER supabase/migrations/20261112_titres_3_gestes_retour.sql@@
  );
  perform pg_temp.etape('retour 3', v_retour, v_mode);
  v_retour := pg_temp.jouer('retour 2',
-- @@INJECTER supabase/migrations/20261112_titres_2_fonctions_retour.sql@@
  );
  perform pg_temp.etape('retour 2', v_retour, v_mode);
  v_retour := pg_temp.jouer('retour 1',
-- @@INJECTER supabase/migrations/20261112_titres_1_tables_retour.sql@@
  );
  v_retour1 := v_retour;
  perform pg_temp.etape('retour 1', v_retour, v_mode);
  select e.regles, e.fonctions, e.droits into v_ap_regles, v_ap_fonctions, v_ap_droits from pg_temp.empreinte() e;
  if v_en_ligne or v_etat1 = 'neutralisée' or v_retour1 = 'neutralisée' then
    perform pg_temp.informer('retours', format('non jugeables (migration 1 ou son retour non injectés) ; empreinte du moment : regles %s, fonctions %s, droits %s',
      v_ap_regles, v_ap_fonctions, v_ap_droits));
  else
    perform pg_temp.attendre('retour', 'après les retours : plus de table titres, plus de colonne titre_id, plus de déclencheur',
      pg_temp.calcul($q$select concat_ws('/', coalesce(to_regclass('public.titres')::text, 'sans table'),
        (select count(*) from pg_attribute where attrelid = 'public.affectations'::regclass and attname = 'titre_id' and not attisdropped)::text,
        (select count(*) from pg_trigger where tgrelid = 'public.affectations'::regclass and tgname = 'affectations_titre')::text)$q$),
      'sans table/0/0');
    perform pg_temp.attendre('retour', 'après les retours : les cinq fonctions de la migration 1 ont disparu',
      pg_temp.calcul($q$select count(*)::text from pg_proc where pronamespace = 'public'::regnamespace and proname in ('_pages_du_niveau', '_cases_valides', 'titre_fixe', '_affectations_titre', '_titres_stable')$q$), '0');
    perform pg_temp.attendre('retour', 'après les retours : empreinte regles identique à celle d''avant', v_ap_regles, v_av_regles);
    perform pg_temp.attendre('retour', 'après les retours : empreinte fonctions identique à celle d''avant', v_ap_fonctions, v_av_fonctions);
    perform pg_temp.attendre('retour', 'après les retours : empreinte droits identique à celle d''avant', v_ap_droits, v_av_droits);
  end if;
  perform pg_temp.informer('durée du bloc', to_char(extract(epoch from clock_timestamp() - v_debut), 'FM990.0') || ' s');
  perform pg_temp.verdict_titres(v_mode, v_debut);
  raise exception 'la preuve doit finir par la levée du verdict';
end $tprv$;
