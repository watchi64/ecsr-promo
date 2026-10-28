-- Recette de génération des marches arrière des étapes 2 et 3 du lot 4 (rôles et portées).
-- À rejouer, en lecture seule (MCP execute_sql), si la production a bougé avant l'application du lot :
-- tests/sql/roles-empreinte.sql ne redonne plus les valeurs de référence du registre, ou une conversation
-- parallèle a modifié une des fonctions ou des tables ci-dessous. Chaque requête rend une ligne par section,
-- avec son md5 : on recolle les sections dans le fichier, puis on vérifie le md5 du texte collé.
--
-- 1. supabase/migrations/20261028_roles_3_regles_retour.sql
--    Corps du fichier, sous l'en-tête et le set local lock_timeout :
--    string_agg(section, E'\n\n' order by ord). Une section par table de public sous RLS, plus storage.objects :
--    suppression de toutes les règles de la table, puis recréation de celles relevées ; le grant de
--    user_profiles suit ses règles.
--
-- 2. supabase/migrations/20261028_roles_2_fonctions_retour.sql
--    Partie 1 : string_agg(section, E'\n\n' order by ord) des lignes 1 à 20 (les fonctions modifiées par
--    l'étape 2). Partie 3 : la ligne 21 (mes_promos), sans sa première ligne de commentaire, après
--    « drop function public.mes_promos(); » et avant ses revoke et grant. La partie 2 (suppression des
--    fonctions créées par l'étape 2) n'est pas générée. nb_surcharges doit valoir 1 partout : sinon un nom
--    désigne plusieurs fonctions et la liste est à revoir.

-- Requête 1 : marche arrière de l'étape 3 (règles).
with tables_rls as (
  select n.nspname::text as s, c.relname::text as t
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p') and c.relrowsecurity
     and (n.nspname = 'public' or (n.nspname = 'storage' and c.relname = 'objects'))
), regles as (
  select schemaname::text as s, tablename::text as t, policyname::text as nom, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname in ('public', 'storage')
), sections as (
  select tr.s, tr.t,
         (select count(*) from regles r where r.s = tr.s and r.t = tr.t) as n,
         (select string_agg(
                   format(E'create policy %I on %I.%I\n  as %s for %s to %s%s%s;',
                          r.nom, r.s, r.t, lower(r.permissive), lower(r.cmd),
                          (select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ' order by x)
                             from unnest(r.roles) x),
                          case when r.qual is not null then E'\n  using (' || r.qual || ')' end,
                          case when r.with_check is not null then E'\n  with check (' || r.with_check || ')' end),
                   E'\n' order by r.nom)
            from regles r where r.s = tr.s and r.t = tr.t) as creations
    from tables_rls tr
), texte as (
  select s, t, n,
         replace(replace(replace($b$-- @S.@T : @N
do $retour$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = '@S' and tablename = '@T' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$retour$;$b$, '@S', s), '@T', t), '@N',
                 case when n = 0 then 'aucune règle (RLS active : table fermée à anon et authenticated)'
                      when n = 1 then '1 règle' else n || ' règles' end)
         || case when n > 0 then E'\n\n' || creations else '' end
         || case when s = 'public' and t = 'user_profiles' then E'\n\n-- L''étape 3 retire l''insertion et la modification de user_profiles à anon et authenticated\n-- (fonctions serveur seulement) : on les redonne.\ngrant insert, update on public.user_profiles to anon, authenticated;' else '' end
         as section
    from sections
)
select row_number() over (order by s, t) as ord, s || '.' || t as cible, n, md5(section) as m, section
  from texte order by s, t;

-- Requête 2 : marche arrière de l'étape 2 (fonctions).
with liste as (
  select u.n as nom, u.o as ord
    from unnest(array['peut_acceder_promo', 'promo_par_defaut', 'promo_courante', 'my_stagiaire_id',
                      'notes_stagiaires_visibles', 'is_admin', 'is_prof', 'is_founder', 'emargement_feuille',
                      'emargement_ouvrir', 'emargement_signer', 'anonymiser_promo', 'anonymiser_stagiaire',
                      'etat_anonymisation_promo', 'set_date_naissance', 'venues_benevoles', 'benevoles_a_purger',
                      'purger_benevoles', 'accepter_brouillon_ia', 'rejeter_brouillon_ia', 'mes_promos'])
         with ordinality as u(n, o)
), f as (
  select l.ord, l.nom,
         (select count(*) from pg_proc q where q.proname = l.nom and q.pronamespace = 'public'::regnamespace)
           as nb_surcharges,
         format(E'-- %s(%s)\n%s;', p.proname, pg_get_function_identity_arguments(p.oid),
                rtrim(pg_get_functiondef(p.oid), E'\n')) as section
    from liste l join pg_proc p on p.proname = l.nom and p.pronamespace = 'public'::regnamespace
)
select ord, nom, nb_surcharges, md5(section) as m, length(section) as len, section
  from f order by ord;
