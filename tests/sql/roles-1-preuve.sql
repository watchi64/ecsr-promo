-- Preuve de l'étape 1 du lot 4 (rôles et portées) : la table affectations et le vocabulaire des rôles, sans rien
-- changer de ce qui existe (plan du lot 4, Task 2).
-- GABARIT, à ne pas jouer tel quel : outils/assembler_repetition_roles.mjs y colle les aides communes
-- (tests/sql/roles-aides.sql) et y injecte en littéraux la requête d'empreinte, la migration et son retour :
--   node outils/assembler_repetition_roles.mjs etape-1 <sortie.sql>         répétition : VERT attendu
--   node outils/assembler_repetition_roles.mjs etape-1-sans <sortie.sql>    migration et retour remplacés par
--                                                                           select 1 : ROUGE attendu
-- Le fichier assemblé se joue en une requête (MCP execute_sql). Tout se passe dans le bloc do final, qui finit
-- TOUJOURS par une levée : migration, personnages fictifs, écritures et retour sont annulés, rien ne reste en base.
-- Le verdict est le message de la levée : « VERT n/0 », ou « ROUGE » et les échecs.
-- Déroulé : empreinte avant ; migration ; structure et amorce ; empreinte des règles hors affectations ;
-- vocabulaire, aperçu, règles et contraintes de la table ; retour ; empreinte après, qui doit égaler celle d'avant.
-- Que l'empreinte d'avant égale les valeurs relevées le 28/10 n'est qu'une information : un écart signale une
-- dérive de la production, pas un défaut de l'étape.
-- Personnages réels choisis par requête et jamais nommés (dépôt public) : le fondateur, les formateurs (role prof
-- et is_admin), un stagiaire avec compte. Personnages fictifs (@exemple.invalid) créés dans le bloc après l'amorce,
-- pour ne pas y entrer : la direction du lieu de la promo 1, celle d'un autre lieu, un siège, et un compte sans
-- affectation, cible des ajouts. Les lieux sont lus en base, jamais supposés.
-- Verrous : les clés étrangères de la nouvelle table verrouillent user_profiles, promos et lieux le temps du bloc
-- (lock_timeout 3 s) : jouer la preuve quelques fois au plus, jamais en boucle.

-- @@INCLURE tests/sql/roles-aides.sql@@

-- Empreinte de la base (regles, fonctions, droits) : tests/sql/roles-empreinte.sql, injecté tel quel.
create or replace function pg_temp.empreinte(out regles text, out fonctions text, out droits text)
language plpgsql as $e$
begin
  execute
-- @@INJECTER tests/sql/roles-empreinte.sql@@
  into regles, fonctions, droits;
end $e$;

do $preuve$
declare
  -- Empreintes : avant la migration, avec la migration mais sans les règles d'affectations, après le retour.
  v_av_regles text; v_av_fonctions text; v_av_droits text;
  v_hors_regles text; v_hors_fonctions text; v_hors_droits text;
  v_ap_regles text; v_ap_fonctions text; v_ap_droits text;
  -- Personnages réels (choisis par requête) et fictifs.
  v_fond text; v_fond_promo integer; v_form text[]; v_stag text; v_stag_promo integer;
  v_dir1 constant text := 'preuve.direction.un@exemple.invalid';
  v_dir2 constant text := 'preuve.direction.deux@exemple.invalid';
  v_siege constant text := 'preuve.siege@exemple.invalid';
  v_cible constant text := 'preuve.cible@exemple.invalid';
  -- Promos et lieux : la promo 1 sert de repère, les lieux sont lus en base.
  v_promo1 constant integer := 1;
  v_promos integer[]; v_lieux integer[]; v_lieu1 integer; v_lieu2 integer; v_promo_l2 integer;
  v_migration boolean := false; v_fictifs boolean := false;
  i integer; v_txt text; v_obt text; v_r record;
  c_vocabulaire constant text[] := array['apercu_role', 'direction_courante', 'equipe_courante', 'est_direction',
    'est_fondateur', 'est_formateur', 'est_siege', 'fondateur_reel', 'formateur_courant', 'lieu_de_promo',
    'redacteur_contenus', 'roles_reels'];
  -- Lignes d'affectations vues (identifiants, dans l'ordre).
  c_ids constant text := $q$select coalesce(string_agg(id::text, ',' order by id), '') from public.affectations$q$;
  -- Attendu d'un retrait sans WHERE (%s : la condition des lignes que la règle laisse retirer) : « OK <n> <restantes> ».
  c_retrait constant text := $q$with t as (select id, coalesce((%s), false) as part from public.affectations)
    select 'OK ' || count(*) filter (where part) || ' '
           || coalesce(string_agg(id::text, ',' order by id) filter (where not part), 'aucune') from t$q$;
begin
  perform set_config('lock_timeout', '3s', true);

  -- 1. Avant la migration : empreinte, personnages réels, promos et lieux.
  select e.regles, e.fonctions, e.droits into v_av_regles, v_av_fonctions, v_av_droits from pg_temp.empreinte() e;
  perform pg_temp.informer('empreinte d''avant égale aux valeurs relevées sur la production le 28/10',
    case when v_av_regles = '1fd532cdaad930909b9cc49ad442dcb6' and v_av_fonctions = '195bf7407724278774a05f984ec042ef'
              and v_av_droits = '3637ceeba6b4746c8583e864dc78e267' then 'oui'
         else format('non (dérive de la production) : regles %s, fonctions %s, droits %s',
                     v_av_regles, v_av_fonctions, v_av_droits) end);
  select up.email, s.promo_id into v_fond, v_fond_promo
    from user_profiles up left join stagiaires s on s.id = up.stagiaire_id
   where up.is_founder order by up.email limit 1;
  v_form := array(select up.email from user_profiles up
                   where up.role = 'prof' and up.is_admin and not up.is_founder order by up.email);
  select up.email, s.promo_id into v_stag, v_stag_promo
    from user_profiles up join stagiaires s on s.id = up.stagiaire_id
   where up.role = 'stagiaire' and not up.is_admin and not up.is_founder and s.actif
   order by s.promo_id, s.id limit 1;
  v_promos := array(select pr.id from promos pr order by pr.id);
  v_lieux := array(select l.id from lieux l order by l.id);
  select pr.lieu_id into v_lieu1 from promos pr where pr.id = v_promo1;
  select pr.lieu_id, pr.id into v_lieu2, v_promo_l2 from promos pr where pr.lieu_id <> v_lieu1 order by pr.id limit 1;
  perform pg_temp.verifier('structure', 'personnages réels, promos et lieux trouvés en base',
    v_fond is not null and cardinality(v_form) > 0 and v_stag is not null and v_lieu1 is not null and v_lieu2 is not null,
    format('%s formateur(s) réel(s) ; promos %s ; lieu de la promo 1 : %s ; autre lieu : %s (promo %s)',
           cardinality(v_form), array_to_string(v_promos, ', '), v_lieu1, v_lieu2, v_promo_l2));

  -- 2. La migration, injectée telle quelle. Une erreur est notée, pas propagée : sa sous-transaction l'annule et la
  --    preuve continue sans elle (tout ce qui en dépend échoue alors).
  begin
    execute
-- @@INJECTER supabase/migrations/20261028_roles_1_fondations.sql@@
    ;
    v_migration := true;
  exception when others then
    v_txt := format('ERREUR %s : %s', sqlstate, left(sqlerrm, 200));
  end;
  perform pg_temp.verifier('structure', 'migration jouée sans erreur', v_migration, v_txt);

  -- 3. Structure : table, colonnes, clés, index, droits, règles, fonctions (catalogue). L'information qui suit
  --    résume ce que la migration a créé : égale à celle d'une répétition locale des mêmes fichiers, elle montre que
  --    le texte joué est bien celui du dépôt.
  perform pg_temp.informer('empreinte de ce que la migration crée (à rapprocher d''une répétition locale des mêmes fichiers)',
    format('fonctions %s ; règles %s ; portée %s',
      coalesce((select md5(string_agg(pg_get_functiondef(p.oid), E'\n' order by p.proname collate "C"))
                  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any (c_vocabulaire)), 'rien'),
      coalesce((select md5(string_agg(format('%s|%s|%s|%s', p.policyname, p.cmd, p.qual, p.with_check), E'\n'
                                      order by p.policyname collate "C"))
                  from pg_policies p where p.schemaname = 'public' and p.tablename = 'affectations'), 'rien'),
      coalesce((select md5(pg_get_constraintdef(k.oid)) from pg_constraint k
                 where k.conrelid = to_regclass('public.affectations') and k.conname = 'affectations_portee'), 'rien')));
  perform pg_temp.verifier('structure', 'table affectations créée, RLS active',
    coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.affectations')), false));
  select string_agg(format('%s %s%s%s', a.attname, format_type(a.atttypid, a.atttypmod),
                           case when a.attnotnull then ' not null' else '' end,
                           case a.attidentity when 'a' then ' identité always' when 'd' then ' identité by default'
                                else '' end), ', ' order by a.attnum)
    into v_obt
    from pg_attribute a
   where a.attrelid = to_regclass('public.affectations') and a.attnum > 0 and not a.attisdropped;
  perform pg_temp.attendre('structure', 'colonnes du modèle : types, non nuls, identité', v_obt,
    'id bigint not null identité always, email text not null, role text not null, promo_id integer, '
    || 'lieu_id integer, cree_le timestamp with time zone not null, cree_par text');
  select string_agg(format('%s>%s.%s(%s) maj %s sup %s', a.attname, n.nspname, c.relname, b.attname,
                           k.confupdtype, k.confdeltype), ', ' order by a.attname)
    into v_obt
    from pg_constraint k
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
    join pg_class c on c.oid = k.confrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute b on b.attrelid = k.confrelid and b.attnum = k.confkey[1]
   where k.conrelid = to_regclass('public.affectations') and k.contype = 'f';
  perform pg_temp.attendre('structure', 'clés étrangères : l''email suit son compte, cascade à la suppression du compte, de la promo, du lieu',
    v_obt, 'email>public.user_profiles(email) maj c sup c, lieu_id>public.lieux(id) maj a sup c, '
           || 'promo_id>public.promos(id) maj a sup c');
  select string_agg(l, ', ' order by l collate "C") into v_obt
    from (select format('%s(%s)%s',
                        case when i.indisprimary then 'clé' when i.indisunique then 'unique' else 'index' end,
                        (select string_agg(a.attname, ',' order by k.o)
                           from unnest(i.indkey::int2[]) with ordinality k(n, o)
                           join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.n),
                        case when i.indnullsnotdistinct then ' nulls not distinct' else '' end) as l
            from pg_index i where i.indrelid = to_regclass('public.affectations')) x;
  perform pg_temp.attendre('structure', 'index : clé, unicité nulls not distinct menée par email (pas d''index email à part), promo_id, lieu_id',
    v_obt, 'clé(id), index(lieu_id), index(promo_id), unique(email,role,promo_id,lieu_id) nulls not distinct');
  select string_agg(l, ', ' order by l collate "C") into v_obt
    from (select format('%s:%s', case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end,
                        a.privilege_type) as l
            from pg_class c cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
           where c.oid = to_regclass('public.affectations')
             and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated'))
          union all
          select format('colonne %s:%s', t.attname, x.privilege_type)
            from pg_attribute t cross join lateral aclexplode(t.attacl) x
           where t.attrelid = to_regclass('public.affectations') and t.attacl is not null
             and (x.grantee = 0 or x.grantee::regrole::text in ('anon', 'authenticated'))) d;
  perform pg_temp.attendre('structure', 'droits de la table : select, insert, delete pour authenticated, rien d''autre',
    v_obt, 'authenticated:DELETE, authenticated:INSERT, authenticated:SELECT');
  select case when to_regclass('public.affectations_id_seq') is null then 'séquence absente'
              else coalesce(string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end
                                       || ':' || a.privilege_type, ', '), 'aucun') end
    into v_obt
    from pg_class c cross join lateral aclexplode(coalesce(c.relacl, acldefault('S', c.relowner))) a
   where c.oid = to_regclass('public.affectations_id_seq')
     and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated'));
  perform pg_temp.attendre('structure', 'séquence de l''identifiant : aucun droit pour anon, authenticated ni PUBLIC',
    v_obt, 'aucun');
  select string_agg(format('%s %s %s %s', p.policyname, p.cmd, p.roles, p.permissive), ', ' order by p.policyname)
    into v_obt
    from pg_policies p where p.schemaname = 'public' and p.tablename = 'affectations';
  perform pg_temp.attendre('structure', 'règles : affectations_lecture, affectations_ajout, affectations_retrait, pour authenticated',
    v_obt, 'affectations_ajout INSERT {authenticated} PERMISSIVE, affectations_lecture SELECT {authenticated} PERMISSIVE, '
           || 'affectations_retrait DELETE {authenticated} PERMISSIVE');
  select string_agg(format('%s(%s) %s', p.proname, pg_get_function_identity_arguments(p.oid),
                           pg_get_function_result(p.oid)), ', ' order by p.proname collate "C")
    into v_obt
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any (c_vocabulaire);
  perform pg_temp.attendre('structure', 'les douze fonctions du vocabulaire, signatures et types rendus', v_obt,
    'apercu_role() text, direction_courante() boolean, equipe_courante() boolean, est_direction(l integer) boolean, '
    || 'est_fondateur() boolean, est_formateur(p integer) boolean, est_siege() boolean, fondateur_reel() boolean, '
    || 'formateur_courant() boolean, lieu_de_promo(p integer) integer, redacteur_contenus() boolean, '
    || 'roles_reels(p integer) text[]');
  select count(*), string_agg(p.proname, ', ' order by p.proname collate "C")
                     filter (where not (p.prosecdef and p.provolatile = 's'
                                        and p.proconfig = array['search_path=public, pg_temp']
                                        and l.lanname = case when p.proname = 'apercu_role' then 'plpgsql' else 'sql' end))
    into i, v_obt
    from pg_proc p join pg_language l on l.oid = p.prolang
   where p.pronamespace = 'public'::regnamespace and p.proname = any (c_vocabulaire);
  perform pg_temp.verifier('structure', 'fonctions : stable, security definer, search_path public, pg_temp ; sql (apercu_role en plpgsql)',
    i = 12 and v_obt is null, format('%s fonction(s) ; hors règle : %s', i, coalesce(v_obt, 'aucune')));
  select string_agg(format('%s:%s', p.proname,
           coalesce((select string_agg(g, '+' order by g collate "C")
                       from (select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as g
                               from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                              where a.privilege_type = 'EXECUTE'
                                and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated'))) x),
                    'aucun')), ', ' order by p.proname collate "C")
    into v_obt
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any (c_vocabulaire);
  perform pg_temp.attendre('structure', 'exécution : rien de public pour fondateur_reel, apercu_role, roles_reels ; anon et authenticated pour les neuf autres',
    v_obt, 'apercu_role:aucun, direction_courante:anon+authenticated, equipe_courante:anon+authenticated, '
           || 'est_direction:anon+authenticated, est_fondateur:anon+authenticated, est_formateur:anon+authenticated, '
           || 'est_siege:anon+authenticated, fondateur_reel:aucun, formateur_courant:anon+authenticated, '
           || 'lieu_de_promo:anon+authenticated, redacteur_contenus:anon+authenticated, roles_reels:aucun');
  perform pg_temp.attendre('structure', 'authenticated puis anon ne peuvent exécuter fondateur_reel, apercu_role, roles_reels',
    concat_ws(' ', pg_temp.valeur(v_form[1], null, null, 'select public.fondateur_reel()::text'),
                   pg_temp.valeur(v_form[1], null, null, 'select public.apercu_role()'),
                   pg_temp.valeur(v_form[1], null, null, format('select public.roles_reels(%s)::text', v_promo1)),
                   pg_temp.valeur(null, null, null, 'select public.fondateur_reel()::text'),
                   pg_temp.valeur(null, null, null, 'select public.apercu_role()'),
                   pg_temp.valeur(null, null, null, format('select public.roles_reels(%s)::text', v_promo1))),
    'ERREUR 42501 ERREUR 42501 ERREUR 42501 ERREUR 42501 ERREUR 42501 ERREUR 42501');

  -- 4. L'amorce : une ligne formateur par compte role prof et is_admin et par promo, et rien d'autre.
  v_txt := (select count(*)::text from user_profiles up cross join promos pr where up.role = 'prof' and up.is_admin);
  perform pg_temp.attendre('amorce', 'une ligne formateur par compte role prof et is_admin et par promo, rien d''autre',
    pg_temp.valeur_proprio(null, null, null, $q$select format('%s lignes, %s de l''amorce', count(*),
      count(*) filter (where role = 'formateur' and cree_par = 'migration 20261028_roles_1')) from public.affectations$q$),
    format('%s lignes, %s de l''amorce', v_txt, v_txt));
  perform pg_temp.attendre('amorce', 'chaque couple (formateur réel, promo) a sa ligne',
    pg_temp.valeur_proprio(null, null, null, $q$select count(*)::text
       from public.user_profiles up cross join public.promos pr
      where up.role = 'prof' and up.is_admin
        and not exists (select 1 from public.affectations a where a.email = up.email and a.role = 'formateur'
                                                               and a.promo_id = pr.id and a.lieu_id is null)$q$),
    '0');
  perform pg_temp.attendre('amorce', 'aucune ligne pour le fondateur',
    pg_temp.valeur_proprio(null, null, null, $q$select count(*)::text from public.affectations a
      join public.user_profiles up on up.email = a.email where up.is_founder$q$), '0');
  perform pg_temp.informer('amorce comparée à l''inventaire du 28/10 (3 comptes, promos 1, 2 et 7 : 9 lignes)',
    format('%s compte(s), promos %s : %s ligne(s) ; %s',
           (select count(*) from user_profiles where role = 'prof' and is_admin), array_to_string(v_promos, ', '), v_txt,
           case when v_txt = '9' and v_promos = array[1, 2, 7] then 'identique' else 'écart avec l''inventaire' end));

  -- 5. Empreinte hors objets nouveaux, la migration en place : dans une sous-transaction annulée aussitôt, on retire
  --    les règles de la table affectations, ses droits et les fonctions du vocabulaire (la table reste : pas de verrou
  --    sur les tables qu'elle référence), puis on relève l'empreinte avec la requête inchangée. Tout ce qui existait
  --    doit être intact, indépendamment de ce que fait le retour.
  begin
    for v_r in select p.policyname from pg_policies p where p.schemaname = 'public' and p.tablename = 'affectations' loop
      execute format('drop policy %I on public.affectations', v_r.policyname);
    end loop;
    if to_regclass('public.affectations') is not null then
      execute 'revoke all on public.affectations from public, anon, authenticated';
    end if;
    for v_r in select p.oid::regprocedure as f from pg_proc p
                where p.pronamespace = 'public'::regnamespace and p.proname = any (c_vocabulaire) loop
      execute format('drop function %s', v_r.f);
    end loop;
    select e.regles, e.fonctions, e.droits into v_hors_regles, v_hors_fonctions, v_hors_droits from pg_temp.empreinte() e;
    raise exception using errcode = 'P0001', message = 'sous-transaction annulée';
  exception when others then
    if sqlerrm <> 'sous-transaction annulée' then
      v_hors_regles := 'ERREUR ' || sqlstate; v_hors_fonctions := v_hors_regles; v_hors_droits := v_hors_regles;
    end if;
  end;
  perform pg_temp.attendre('plan', 'empreinte regles hors table affectations inchangée', v_hors_regles, v_av_regles);
  perform pg_temp.attendre('structure', 'empreinte fonctions hors vocabulaire inchangée (aucune fonction existante touchée)',
    v_hors_fonctions, v_av_fonctions);
  perform pg_temp.attendre('structure', 'empreinte droits hors table affectations inchangée (aucun droit existant touché)',
    v_hors_droits, v_av_droits);

  -- 6. Personnages fictifs, créés après l'amorce (ils n'y entrent pas). Tous en role prof sans is_admin : à
  --    l'étape 1, l'accès aux promos (peut_acceder_promo, donc promo_courante) lit encore cette colonne ; seules
  --    leurs affectations les distinguent.
  insert into user_profiles (email, role) values (v_dir1, 'prof'), (v_dir2, 'prof'), (v_siege, 'prof'), (v_cible, 'prof');
  v_txt := null;
  begin
    execute format('insert into public.affectations (email, role, lieu_id) values (%L, %L, %s), (%L, %L, %s), (%L, %L, null)',
                   v_dir1, 'direction', v_lieu1, v_dir2, 'direction', v_lieu2, v_siege, 'siege');
    v_fictifs := true;
  exception when others then
    v_txt := 'ERREUR ' || sqlstate;
  end;
  perform pg_temp.verifier('structure', 'personnages fictifs posés : direction du lieu de la promo 1, direction de l''autre lieu, siège',
    v_fictifs, v_txt);

  -- 7. Vocabulaire, sans aperçu.
  for i in 1 .. cardinality(v_form) loop
    perform pg_temp.attendre('plan', format('formateur réel %s : est_formateur vrai sur chaque promo (%s) après l''amorce',
                                            i, array_to_string(v_promos, ', ')),
      pg_temp.sur_chaque(v_form[i], null, null, 'select public.est_formateur(%s)::text', v_promos),
      pg_temp.partout(v_promos, 'true'));
  end loop;
  perform pg_temp.attendre('plan', 'stagiaire réel : est_formateur faux sur chaque promo',
    pg_temp.sur_chaque(v_stag, null, null, 'select public.est_formateur(%s)::text', v_promos),
    pg_temp.partout(v_promos, 'false'));
  perform pg_temp.attendre('plan', 'fondateur : est_fondateur() vrai',
    pg_temp.valeur(v_fond, null, null, 'select public.est_fondateur()::text'), 'true');
  perform pg_temp.attendre('plan', format('direction fictive du lieu %s (celui de la promo 1) : est_direction(%s) vrai', v_lieu1, v_lieu1),
    pg_temp.valeur(v_dir1, null, null, format('select public.est_direction(%s)::text', v_lieu1)), 'true');
  perform pg_temp.attendre('plan', format('direction fictive du lieu %s : est_direction(%s) faux (autre lieu)', v_lieu1, v_lieu2),
    pg_temp.valeur(v_dir1, null, null, format('select public.est_direction(%s)::text', v_lieu2)), 'false');
  perform pg_temp.attendre('vocabulaire', 'est_fondateur() faux : formateur réel 1, stagiaire réel, direction et siège fictifs, visiteur',
    concat_ws(' ', pg_temp.valeur(v_form[1], null, null, 'select public.est_fondateur()::text'),
                   pg_temp.valeur(v_stag, null, null, 'select public.est_fondateur()::text'),
                   pg_temp.valeur(v_dir1, null, null, 'select public.est_fondateur()::text'),
                   pg_temp.valeur(v_siege, null, null, 'select public.est_fondateur()::text'),
                   pg_temp.valeur(null, null, null, 'select public.est_fondateur()::text')),
    'false false false false false');
  perform pg_temp.attendre('vocabulaire', 'fondateur sans aperçu : formateur de chaque promo, direction de chaque lieu, siège',
    concat_ws(' ', pg_temp.sur_chaque(v_fond, null, null, 'select public.est_formateur(%s)::text', v_promos),
                   pg_temp.sur_chaque(v_fond, null, null, 'select public.est_direction(%s)::text', v_lieux),
                   pg_temp.valeur(v_fond, null, null, 'select public.est_siege()::text')),
    concat_ws(' ', pg_temp.partout(v_promos, 'true'), pg_temp.partout(v_lieux, 'true'), 'true'));
  perform pg_temp.attendre('vocabulaire', 'direction fictive : formatrice d''aucune promo, siège non',
    concat_ws(' ', pg_temp.sur_chaque(v_dir1, null, null, 'select public.est_formateur(%s)::text', v_promos),
                   pg_temp.valeur(v_dir1, null, null, 'select public.est_siege()::text')),
    concat_ws(' ', pg_temp.partout(v_promos, 'false'), 'false'));
  perform pg_temp.attendre('vocabulaire', 'direction fictive de l''autre lieu : direction de ce seul lieu',
    pg_temp.sur_chaque(v_dir2, null, null, 'select public.est_direction(%s)::text', v_lieux),
    (select string_agg(x || '=' || (x = v_lieu2)::text, ' ' order by o) from unnest(v_lieux) with ordinality u(x, o)));
  perform pg_temp.attendre('vocabulaire', 'formateur réel 1 et stagiaire réel : direction d''aucun lieu, siège non',
    concat_ws(' ', pg_temp.sur_chaque(v_form[1], null, null, 'select public.est_direction(%s)::text', v_lieux),
                   pg_temp.valeur(v_form[1], null, null, 'select public.est_siege()::text'),
                   pg_temp.sur_chaque(v_stag, null, null, 'select public.est_direction(%s)::text', v_lieux),
                   pg_temp.valeur(v_stag, null, null, 'select public.est_siege()::text')),
    concat_ws(' ', pg_temp.partout(v_lieux, 'false'), 'false', pg_temp.partout(v_lieux, 'false'), 'false'));
  perform pg_temp.attendre('vocabulaire', 'siège fictif : est_siege vrai ; ni formateur, ni direction, ni fondateur',
    concat_ws(' ', pg_temp.valeur(v_siege, null, null, 'select public.est_siege()::text'),
                   pg_temp.sur_chaque(v_siege, null, null, 'select public.est_formateur(%s)::text', v_promos),
                   pg_temp.sur_chaque(v_siege, null, null, 'select public.est_direction(%s)::text', v_lieux),
                   pg_temp.valeur(v_siege, null, null, 'select public.est_fondateur()::text')),
    concat_ws(' ', 'true', pg_temp.partout(v_promos, 'false'), pg_temp.partout(v_lieux, 'false'), 'false'));
  perform pg_temp.attendre('vocabulaire', 'lieu_de_promo : le lieu de chaque promo, pour le visiteur aussi',
    pg_temp.sur_chaque(null, null, null, 'select public.lieu_de_promo(%s)::text', v_promos),
    (select string_agg(pr.id || '=' || pr.lieu_id, ' ' order by pr.id) from promos pr));
  perform pg_temp.attendre('vocabulaire', 'formateur_courant, equipe_courante, redacteur_contenus : formateur réel 1 sur chaque promo affichée',
    concat_ws(' ', pg_temp.sur_chaque_promo(v_form[1], null, 'select public.formateur_courant()::text', v_promos),
                   pg_temp.sur_chaque_promo(v_form[1], null, 'select public.equipe_courante()::text', v_promos),
                   pg_temp.sur_chaque_promo(v_form[1], null, 'select public.redacteur_contenus()::text', v_promos)),
    concat_ws(' ', pg_temp.partout(v_promos, 'true'), pg_temp.partout(v_promos, 'true'), pg_temp.partout(v_promos, 'true')));
  perform pg_temp.attendre('vocabulaire', 'direction_courante et equipe_courante : direction fictive sur les promos de son lieu seulement',
    concat_ws(' ', pg_temp.sur_chaque_promo(v_dir1, null, 'select public.direction_courante()::text', v_promos),
                   pg_temp.sur_chaque_promo(v_dir1, null, 'select public.equipe_courante()::text', v_promos)),
    (select concat_ws(' ', string_agg(pr.id || '=' || (pr.lieu_id = v_lieu1)::text, ' ' order by pr.id),
                           string_agg(pr.id || '=' || (pr.lieu_id = v_lieu1)::text, ' ' order by pr.id)) from promos pr));
  perform pg_temp.attendre('vocabulaire', 'redacteur_contenus : le siège oui, la direction non (promo 1 affichée)',
    concat_ws(' ', pg_temp.valeur(v_siege, v_promo1::text, null, 'select public.redacteur_contenus()::text'),
                   pg_temp.valeur(v_dir1, v_promo1::text, null, 'select public.redacteur_contenus()::text')),
    'true false');
  perform pg_temp.attendre('vocabulaire', 'stagiaire réel sur sa promo : ni formateur, ni équipe, ni rédacteur ; siège fictif : pas d''équipe',
    concat_ws(' ', pg_temp.valeur(v_stag, v_stag_promo::text, null, $q$select concat_ws(' ', public.formateur_courant()::text,
                     public.direction_courante()::text, public.equipe_courante()::text, public.redacteur_contenus()::text)$q$),
                   pg_temp.valeur(v_siege, v_promo1::text, null, 'select public.equipe_courante()::text')),
    'false false false false false');
  perform pg_temp.attendre('vocabulaire', 'visiteur (anon) : les fonctions des règles s''exécutent et rendent faux',
    pg_temp.valeur(null, v_promo1::text, null, format($q$select concat_ws(' ', public.est_fondateur()::text, public.est_formateur(%s)::text,
      public.est_direction(%s)::text, public.est_siege()::text, public.formateur_courant()::text, public.direction_courante()::text,
      public.equipe_courante()::text, public.redacteur_contenus()::text)$q$, v_promo1, v_lieu1)),
    'false false false false false false false false');
  perform pg_temp.attendre('vocabulaire', 'fondateur_reel (en propriétaire) : vrai pour le fondateur, aperçu ou non ; faux pour formateur réel 1 et le visiteur',
    concat_ws(' ', pg_temp.valeur_proprio(v_fond, null, null, 'select public.fondateur_reel()::text'),
                   pg_temp.valeur_proprio(v_fond, v_promo1::text, 'stagiaire', 'select public.fondateur_reel()::text'),
                   pg_temp.valeur_proprio(v_form[1], null, null, 'select public.fondateur_reel()::text'),
                   pg_temp.valeur_proprio(null, null, null, 'select public.fondateur_reel()::text')),
    'true true false false');
  perform pg_temp.attendre('vocabulaire', 'roles_reels (en propriétaire) : formateur réel 1, {formateur} sur chaque promo, aperçu stagiaire ignoré',
    pg_temp.sur_chaque(v_form[1], v_promo1::text, 'stagiaire', 'select public.roles_reels(%s)::text', v_promos, true),
    pg_temp.partout(v_promos, '{formateur}'));
  perform pg_temp.attendre('vocabulaire', 'roles_reels : stagiaire réel, {stagiaire} sur sa promo seulement',
    pg_temp.sur_chaque(v_stag, null, null, 'select public.roles_reels(%s)::text', v_promos, true),
    (select string_agg(x || '=' || case when x = v_stag_promo then '{stagiaire}' else '{}' end, ' ' order by o)
       from unnest(v_promos) with ordinality u(x, o)));
  perform pg_temp.attendre('vocabulaire', 'roles_reels : fondateur, sa seule fiche, jamais de drapeau fondateur, aperçu formateur ignoré',
    pg_temp.sur_chaque(v_fond, v_promo1::text, 'formateur', 'select public.roles_reels(%s)::text', v_promos, true),
    (select string_agg(x || '=' || case when x = v_fond_promo then '{stagiaire}' else '{}' end, ' ' order by o)
       from unnest(v_promos) with ordinality u(x, o)));
  perform pg_temp.attendre('vocabulaire', 'roles_reels : direction fictive, {direction} sur les promos de son lieu ; siège fictif, rien',
    concat_ws(' | ', pg_temp.sur_chaque(v_dir1, null, null, 'select public.roles_reels(%s)::text', v_promos, true),
                     pg_temp.sur_chaque(v_siege, null, null, 'select public.roles_reels(%s)::text', v_promos, true)),
    concat_ws(' | ', (select string_agg(pr.id || '=' || case when pr.lieu_id = v_lieu1 then '{direction}' else '{}' end,
                                        ' ' order by pr.id) from promos pr),
                     pg_temp.partout(v_promos, '{}')));

  -- 8. Aperçu (en-tête x-apercu-role) : il ne fait que retirer des droits.
  perform pg_temp.attendre('plan', 'fondateur en aperçu stagiaire : est_fondateur() faux',
    pg_temp.valeur(v_fond, v_promo1::text, 'stagiaire', 'select public.est_fondateur()::text'), 'false');
  perform pg_temp.attendre('plan', 'stagiaire réel qui envoie x-apercu-role formateur : apercu_role() nul',
    pg_temp.valeur_proprio(v_stag, v_stag_promo::text, 'formateur', $q$select coalesce(public.apercu_role(), 'nul')$q$),
    'nul');
  perform pg_temp.attendre('plan', 'formateur réel 1 qui envoie x-apercu-role stagiaire : apercu_role() = stagiaire',
    pg_temp.valeur_proprio(v_form[1], v_promo1::text, 'stagiaire', $q$select coalesce(public.apercu_role(), 'nul')$q$),
    'stagiaire');
  perform pg_temp.attendre('plan', 'formateur réel 1 en aperçu stagiaire : est_formateur(1) faux',
    pg_temp.valeur(v_form[1], v_promo1::text, 'stagiaire', format('select public.est_formateur(%s)::text', v_promo1)),
    'false');
  perform pg_temp.attendre('plan', 'fondateur en aperçu siege : est_siege() vrai',
    pg_temp.valeur(v_fond, v_promo1::text, 'siege', 'select public.est_siege()::text'), 'true');
  perform pg_temp.attendre('aperçu', 'apercu_role (en propriétaire), fondateur : les quatre rôles honorés ; nul sans en-tête ou pour une valeur inconnue',
    pg_temp.selon_apercu(v_fond, v_promo1::text, $q$select coalesce(public.apercu_role(), 'nul')$q$,
                         array['stagiaire', 'formateur', 'direction', 'siege', null, 'admin'], true),
    'stagiaire=stagiaire formateur=formateur direction=direction siege=siege aucun=nul admin=nul');
  perform pg_temp.attendre('aperçu', 'apercu_role (en propriétaire), formateur réel 1 : stagiaire honoré ; formateur, direction, siege refusés',
    pg_temp.selon_apercu(v_form[1], v_promo1::text, $q$select coalesce(public.apercu_role(), 'nul')$q$,
                         array['stagiaire', 'formateur', 'direction', 'siege'], true),
    'stagiaire=stagiaire formateur=nul direction=nul siege=nul');
  perform pg_temp.attendre('aperçu', 'apercu_role (en propriétaire), visiteur : stagiaire honoré, siege refusé',
    pg_temp.selon_apercu(null, null, $q$select coalesce(public.apercu_role(), 'nul')$q$, array['stagiaire', 'siege'], true),
    'stagiaire=stagiaire siege=nul');
  v_obt := null;
  begin
    perform pg_temp.contexte(v_fond, null, null);
    perform set_config('request.headers', '{"x-apercu-role": "siege"', true);
    execute $q$select coalesce(public.apercu_role(), 'nul')$q$ into v_obt;
  exception when others then
    v_obt := 'ERREUR ' || sqlstate;
  end;
  perform pg_temp.proprio();
  perform pg_temp.attendre('aperçu', 'apercu_role (en propriétaire), en-têtes illisibles (JSON tronqué) : nul', v_obt, 'nul');
  perform pg_temp.attendre('aperçu', 'fondateur en aperçu formateur, promo 1 affichée : formateur de la seule promo 1, direction d''aucun lieu ; ni fondateur, ni siège',
    concat_ws(' ', pg_temp.sur_chaque(v_fond, v_promo1::text, 'formateur', 'select public.est_formateur(%s)::text', v_promos),
                   pg_temp.sur_chaque(v_fond, v_promo1::text, 'formateur', 'select public.est_direction(%s)::text', v_lieux),
                   pg_temp.valeur(v_fond, v_promo1::text, 'formateur', $q$select concat_ws(' ', public.est_fondateur()::text,
                     public.est_siege()::text, public.formateur_courant()::text, public.equipe_courante()::text, public.redacteur_contenus()::text)$q$)),
    concat_ws(' ', (select string_agg(x || '=' || (x = v_promo1)::text, ' ' order by o) from unnest(v_promos) with ordinality u(x, o)),
                   pg_temp.partout(v_lieux, 'false'), 'false false true true true'));
  perform pg_temp.attendre('aperçu', 'fondateur en aperçu direction, promo 1 affichée : direction du seul lieu de la promo 1 ; ni formateur, ni fondateur, ni siège',
    concat_ws(' ', pg_temp.sur_chaque(v_fond, v_promo1::text, 'direction', 'select public.est_direction(%s)::text', v_lieux),
                   pg_temp.sur_chaque(v_fond, v_promo1::text, 'direction', 'select public.est_formateur(%s)::text', v_promos),
                   pg_temp.valeur(v_fond, v_promo1::text, 'direction', $q$select concat_ws(' ', public.est_fondateur()::text,
                     public.est_siege()::text, public.direction_courante()::text, public.equipe_courante()::text, public.redacteur_contenus()::text)$q$)),
    concat_ws(' ', (select string_agg(x || '=' || (x = v_lieu1)::text, ' ' order by o) from unnest(v_lieux) with ordinality u(x, o)),
                   pg_temp.partout(v_promos, 'false'), 'false false true true false'));
  perform pg_temp.attendre('aperçu', 'fondateur en aperçu siege : ni formateur, ni direction, ni fondateur ; rédacteur des contenus',
    concat_ws(' ', pg_temp.sur_chaque(v_fond, v_promo1::text, 'siege', 'select public.est_formateur(%s)::text', v_promos),
                   pg_temp.sur_chaque(v_fond, v_promo1::text, 'siege', 'select public.est_direction(%s)::text', v_lieux),
                   pg_temp.valeur(v_fond, v_promo1::text, 'siege', $q$select concat_ws(' ', public.est_fondateur()::text,
                     public.redacteur_contenus()::text)$q$)),
    concat_ws(' ', pg_temp.partout(v_promos, 'false'), pg_temp.partout(v_lieux, 'false'), 'false true'));
  perform pg_temp.attendre('aperçu', 'fondateur en aperçu stagiaire : aucun rôle d''équipe',
    concat_ws(' ', pg_temp.sur_chaque(v_fond, v_promo1::text, 'stagiaire', 'select public.est_formateur(%s)::text', v_promos),
                   pg_temp.sur_chaque(v_fond, v_promo1::text, 'stagiaire', 'select public.est_direction(%s)::text', v_lieux),
                   pg_temp.valeur(v_fond, v_promo1::text, 'stagiaire', $q$select concat_ws(' ', public.est_siege()::text,
                     public.equipe_courante()::text, public.redacteur_contenus()::text)$q$)),
    concat_ws(' ', pg_temp.partout(v_promos, 'false'), pg_temp.partout(v_lieux, 'false'), 'false false false'));
  perform pg_temp.attendre('aperçu', 'fondateur avec une valeur d''aperçu inconnue : aperçu ignoré, fondateur et siège',
    pg_temp.valeur(v_fond, v_promo1::text, 'admin', $q$select concat_ws(' ', public.est_fondateur()::text, public.est_siege()::text)$q$),
    'true true');
  perform pg_temp.attendre('aperçu', 'formateur réel 1 qui envoie siege (refusé) : rien ne change',
    pg_temp.valeur(v_form[1], v_promo1::text, 'siege', format($q$select concat_ws(' ', public.est_siege()::text,
      public.est_formateur(%s)::text, public.formateur_courant()::text)$q$, v_promo1)),
    'false true true');
  perform pg_temp.attendre('aperçu', 'formateur réel 1 en aperçu stagiaire : formateur d''aucune promo, ni équipe, ni rédacteur',
    concat_ws(' ', pg_temp.sur_chaque(v_form[1], v_promo1::text, 'stagiaire', 'select public.est_formateur(%s)::text', v_promos),
                   pg_temp.valeur(v_form[1], v_promo1::text, 'stagiaire', $q$select concat_ws(' ', public.formateur_courant()::text,
                     public.equipe_courante()::text, public.redacteur_contenus()::text)$q$)),
    concat_ws(' ', pg_temp.partout(v_promos, 'false'), 'false false false'));
  perform pg_temp.attendre('aperçu', 'stagiaire réel qui envoie formateur (refusé) : toujours pas formateur',
    pg_temp.valeur(v_stag, v_stag_promo::text, 'formateur', 'select public.formateur_courant()::text'), 'false');

  -- 9. Règles de la table affectations. Lecture : la liste exacte des lignes vues, comparée à la matrice écrite ici
  --    en SQL direct. Écritures toujours annulées (sous-transaction) ; un ajout se tente sans RETURNING et un retrait
  --    sans WHERE, pour que seule la règle d'écriture joue (celle de lecture s'y ajoute dès qu'une colonne est lue).
  perform pg_temp.attendre('affectations', 'lecture, formateur réel 1 : ses lignes et les formateurs de ses promos',
    pg_temp.valeur(v_form[1], null, null, c_ids),
    pg_temp.calcul(format($q$select coalesce(string_agg(a.id::text, ',' order by a.id), '') from public.affectations a
      where a.email = %L or (a.role = 'formateur' and a.promo_id in (select b.promo_id from public.affectations b
                                                                      where b.email = %L and b.role = 'formateur'))$q$,
      v_form[1], v_form[1])));
  perform pg_temp.attendre('affectations', 'lecture, direction du lieu de la promo 1 : sa ligne, les formateurs des promos de son lieu, les directions de son lieu',
    pg_temp.valeur(v_dir1, null, null, c_ids),
    pg_temp.calcul(format($q$select coalesce(string_agg(a.id::text, ',' order by a.id), '') from public.affectations a
      where a.email = %L or (a.role = 'formateur' and a.promo_id in (select pr.id from public.promos pr where pr.lieu_id = %s))
         or (a.role = 'direction' and a.lieu_id = %s)$q$, v_dir1, v_lieu1, v_lieu1)));
  perform pg_temp.attendre('affectations', 'lecture, siège fictif : sa ligne, les directions et le siège',
    pg_temp.valeur(v_siege, null, null, c_ids),
    pg_temp.calcul(format($q$select coalesce(string_agg(a.id::text, ',' order by a.id), '') from public.affectations a
      where a.email = %L or a.role in ('direction', 'siege')$q$, v_siege)));
  perform pg_temp.attendre('affectations', 'lecture, fondateur : tout',
    pg_temp.valeur(v_fond, null, null, c_ids), pg_temp.calcul(c_ids));
  perform pg_temp.attendre('affectations', 'lecture, fondateur en aperçu formateur (promo 1 affichée) : les formateurs de la promo 1',
    pg_temp.valeur(v_fond, v_promo1::text, 'formateur', c_ids),
    pg_temp.calcul(format($q$select coalesce(string_agg(a.id::text, ',' order by a.id), '') from public.affectations a
      where a.role = 'formateur' and a.promo_id = %s$q$, v_promo1)));
  perform pg_temp.attendre('affectations', 'lecture, fondateur en aperçu stagiaire et stagiaire réel : rien ; visiteur : refusé',
    concat_ws(' ; ', coalesce(nullif(pg_temp.valeur(v_fond, v_promo1::text, 'stagiaire', c_ids), ''), 'aucune'),
                     coalesce(nullif(pg_temp.valeur(v_stag, null, null, c_ids), ''), 'aucune'),
                     pg_temp.valeur(null, null, null, c_ids)),
    'aucune ; aucune ; ERREUR 42501');
  perform pg_temp.attendre('affectations', 'ajout, direction du lieu de la promo 1 : un formateur de la promo 1 (cree_par et cree_le posés par défaut)',
    pg_temp.ecrire(v_dir1, null, null,
      format('insert into public.affectations (email, role, promo_id) values (%L, ''formateur'', %s)', v_cible, v_promo1),
      format('select (cree_par = %L and cree_le = now())::text from public.affectations where email = %L', v_dir1, v_cible)),
    'OK 1 true');
  perform pg_temp.attendre('affectations', 'ajout refusé, direction du lieu de la promo 1 : un formateur d''une promo d''un autre lieu, une direction',
    concat_ws(' ; ',
      pg_temp.ecrire(v_dir1, null, null,
        format('insert into public.affectations (email, role, promo_id) values (%L, ''formateur'', %s)', v_cible, v_promo_l2)),
      pg_temp.ecrire(v_dir1, null, null,
        format('insert into public.affectations (email, role, lieu_id) values (%L, ''direction'', %s)', v_cible, v_lieu1))),
    'REFUS 42501 ; REFUS 42501');
  perform pg_temp.attendre('affectations', 'ajout, siège fictif : une direction permise, un siège refusé',
    concat_ws(' ; ',
      pg_temp.ecrire(v_siege, null, null,
        format('insert into public.affectations (email, role, lieu_id) values (%L, ''direction'', %s)', v_cible, v_lieu2)),
      pg_temp.ecrire(v_siege, null, null, format('insert into public.affectations (email, role) values (%L, ''siege'')', v_cible))),
    'OK 1 ; REFUS 42501');
  perform pg_temp.attendre('affectations', 'ajout, fondateur : un siège permis ; en aperçu siege : un siège refusé, une direction permise',
    concat_ws(' ; ',
      pg_temp.ecrire(v_fond, null, null, format('insert into public.affectations (email, role) values (%L, ''siege'')', v_cible)),
      pg_temp.ecrire(v_fond, v_promo1::text, 'siege',
        format('insert into public.affectations (email, role) values (%L, ''siege'')', v_cible)),
      pg_temp.ecrire(v_fond, v_promo1::text, 'siege',
        format('insert into public.affectations (email, role, lieu_id) values (%L, ''direction'', %s)', v_cible, v_lieu1))),
    'OK 1 ; REFUS 42501 ; OK 1');
  v_txt := format('insert into public.affectations (email, role, promo_id) values (%L, ''formateur'', %s)', v_cible, v_promo1);
  perform pg_temp.attendre('affectations', 'ajout refusé : formateur réel 1 (un formateur de sa promo), stagiaire réel, visiteur',
    concat_ws(' ; ', pg_temp.ecrire(v_form[1], null, null, v_txt), pg_temp.ecrire(v_stag, null, null, v_txt),
                     pg_temp.ecrire(null, null, null, v_txt)),
    'REFUS 42501 ; REFUS 42501 ; REFUS 42501');
  perform pg_temp.attendre('affectations', 'retrait, direction du lieu de la promo 1 : les formateurs des promos de son lieu, rien d''autre',
    pg_temp.ecrire(v_dir1, null, null, 'delete from public.affectations', c_ids),
    pg_temp.calcul(format(c_retrait, format('role = ''formateur'' and promo_id in (select pr.id from public.promos pr where pr.lieu_id = %s)', v_lieu1))));
  perform pg_temp.attendre('affectations', 'retrait, siège fictif : les directions, rien d''autre',
    pg_temp.ecrire(v_siege, null, null, 'delete from public.affectations', c_ids),
    pg_temp.calcul(format(c_retrait, 'role = ''direction''')));
  perform pg_temp.attendre('affectations', 'retrait, fondateur : tout',
    pg_temp.ecrire(v_fond, null, null, 'delete from public.affectations', c_ids), pg_temp.calcul(format(c_retrait, 'true')));
  perform pg_temp.attendre('affectations', 'retrait, fondateur en aperçu direction (promo 1 affichée) : les formateurs des promos de ce lieu seulement',
    pg_temp.ecrire(v_fond, v_promo1::text, 'direction', 'delete from public.affectations', c_ids),
    pg_temp.calcul(format(c_retrait, format('role = ''formateur'' and promo_id in (select pr.id from public.promos pr where pr.lieu_id = %s)', v_lieu1))));
  perform pg_temp.attendre('affectations', 'retrait, formateur réel 1, stagiaire réel, fondateur en aperçu stagiaire : rien',
    concat_ws(' ; ', pg_temp.ecrire(v_form[1], null, null, 'delete from public.affectations', c_ids),
                     pg_temp.ecrire(v_stag, null, null, 'delete from public.affectations', c_ids),
                     pg_temp.ecrire(v_fond, v_promo1::text, 'stagiaire', 'delete from public.affectations', c_ids)),
    (select concat_ws(' ; ', x, x, x) from (select pg_temp.calcul(format(c_retrait, 'false')) as x) y));
  perform pg_temp.attendre('affectations', 'aucune modification, même pour le fondateur (on retire puis on ajoute)',
    concat_ws(' ; ', pg_temp.ecrire(v_form[1], null, null, 'update public.affectations set cree_par = cree_par'),
                     pg_temp.ecrire(v_fond, null, null, 'update public.affectations set cree_par = cree_par')),
    'REFUS 42501 ; REFUS 42501');

  -- 10. Contraintes, en propriétaire (écritures annulées aussitôt).
  perform pg_temp.attendre('plan', 'contrainte de portée : un formateur sans promo est refusé',
    pg_temp.ecrire_proprio(format('insert into public.affectations (email, role) values (%L, ''formateur'')', v_cible)),
    'REFUS 23514 affectations_portee');
  perform pg_temp.attendre('contraintes', 'portée : direction sans lieu, direction avec une promo, siège avec un lieu, formateur avec un lieu : refusés',
    concat_ws(' ; ',
      pg_temp.ecrire_proprio(format('insert into public.affectations (email, role) values (%L, ''direction'')', v_cible)),
      pg_temp.ecrire_proprio(format('insert into public.affectations (email, role, promo_id, lieu_id) values (%L, ''direction'', %s, %s)',
                                    v_cible, v_promo1, v_lieu1)),
      pg_temp.ecrire_proprio(format('insert into public.affectations (email, role, lieu_id) values (%L, ''siege'', %s)', v_cible, v_lieu1)),
      pg_temp.ecrire_proprio(format('insert into public.affectations (email, role, promo_id, lieu_id) values (%L, ''formateur'', %s, %s)',
                                    v_cible, v_promo1, v_lieu1))),
    'REFUS 23514 affectations_portee ; REFUS 23514 affectations_portee ; REFUS 23514 affectations_portee ; '
    || 'REFUS 23514 affectations_portee');
  v_obt := pg_temp.ecrire_proprio(format('insert into public.affectations (email, role) values (%L, ''admin'')', v_cible));
  perform pg_temp.verifier('contraintes', 'rôle inconnu refusé', v_obt like 'REFUS 23514 %', v_obt);
  perform pg_temp.attendre('contraintes', 'unicité : une même direction deux fois, un même siège deux fois (nulls not distinct) : refusés',
    concat_ws(' ; ',
      pg_temp.ecrire_proprio(format('insert into public.affectations (email, role, lieu_id) values (%L, ''direction'', %s)', v_dir1, v_lieu1)),
      pg_temp.ecrire_proprio(format('insert into public.affectations (email, role) values (%L, ''siege'')', v_siege))),
    'REFUS 23505 affectations_unique ; REFUS 23505 affectations_unique');
  perform pg_temp.attendre('contraintes', 'clés étrangères : compte inconnu et promo inconnue refusés',
    concat_ws(' ; ',
      pg_temp.ecrire_proprio($q$insert into public.affectations (email, role) values ('preuve.inconnu@exemple.invalid', 'siege')$q$),
      pg_temp.ecrire_proprio(format('insert into public.affectations (email, role, promo_id) values (%L, ''formateur'', %s)',
                                    v_cible, (select max(pr.id) + 1000 from promos pr)))),
    'REFUS 23503 affectations_email_fkey ; REFUS 23503 affectations_promo_id_fkey');
  perform pg_temp.attendre('contraintes', 'compte supprimé : ses affectations partent ; email changé : elles le suivent',
    concat_ws(' ; ',
      pg_temp.ecrire_proprio(format('delete from public.user_profiles where email = %L', v_dir2),
        format('select count(*)::text from public.affectations where email = %L', v_dir2)),
      pg_temp.ecrire_proprio(format('update public.user_profiles set email = %L where email = %L', 'preuve.renommee@exemple.invalid', v_dir2),
        $q$select count(*)::text from public.affectations where email = 'preuve.renommee@exemple.invalid'$q$)),
    'OK 1 0 ; OK 1 1');

  -- 11. Le retour, injecté tel quel, puis l'empreinte : elle doit égaler celle d'avant la migration.
  v_txt := null;
  begin
    execute
-- @@INJECTER supabase/migrations/20261028_roles_1_fondations_retour.sql@@
    ;
  exception when others then
    v_txt := format('ERREUR %s : %s', sqlstate, left(sqlerrm, 200));
  end;
  perform pg_temp.verifier('structure', 'retour joué sans erreur', v_txt is null, v_txt);
  select e.regles, e.fonctions, e.droits into v_ap_regles, v_ap_fonctions, v_ap_droits from pg_temp.empreinte() e;
  perform pg_temp.attendre('plan', 'retour joué : empreinte regles identique à celle d''avant la migration', v_ap_regles, v_av_regles);
  perform pg_temp.attendre('plan', 'retour joué : empreinte fonctions identique à celle d''avant la migration', v_ap_fonctions, v_av_fonctions);
  perform pg_temp.attendre('plan', 'retour joué : empreinte droits identique à celle d''avant la migration', v_ap_droits, v_av_droits);
  perform pg_temp.verifier('structure', 'après le retour : ni table affectations, ni fonction du vocabulaire',
    to_regclass('public.affectations') is null
    and not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any (c_vocabulaire)));

  perform pg_temp.verdict();
  raise exception 'la preuve doit finir par la levée du verdict';
end $preuve$;
