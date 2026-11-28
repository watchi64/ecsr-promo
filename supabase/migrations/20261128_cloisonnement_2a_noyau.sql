-- Cloisonnement par organisme, étape 2a : le noyau (spec docs/superpowers/specs/2026-11-27-cloisonnement-organismes-design.md,
-- § 5.2 ; plan, tâche 3). Les prédicats centraux du fondateur et du siège sont bornés à l'organisme. Mêmes signatures, mêmes
-- droits d'exécution (create or replace), security definer et chemin de recherche gardés. Avec un seul organisme (ECF
-- aujourd'hui), rien ne change : la preuve le montre fonction par fonction et personnage par personnage (groupe equivalence-ecf).
-- Ce qu'elle change :
--   * Le fondateur (fondateur_reel) : tout dans son organisme actif (rattachement, ou accès support ouvert), rien ailleurs, ses
--     propres fiches et affectations comprises. est_formateur(p), est_direction(l), peut_acceder_promo(p), case_promo,
--     case_centre, formateur_fixe, direction_fixe et membre_stagiaire le jugent par fondateur_sur(organisme de la promo ou du
--     centre) ; une promo ou un centre nul ou inconnu (lignes communes) se juge sur son organisme actif, comme avant.
--   * Le siège : est_siege() = siège de organisme_courant() ; case_reseau et siege_fixe ne retiennent que l'affectation siège de
--     organisme_courant() (le fondateur : son organisme actif).
--   * L'aperçu (x-apercu-role) : apercu_role() inchangé ; chaque branche d'aperçu de ces prédicats passe aussi par fondateur_sur.
--   * promo_par_defaut() : la promo de la fiche stagiaire n'est retenue que si elle est accessible (le fondateur en support ne
--     retombe pas sur sa fiche d'ECF). mes_promos() n'est pas réécrite : elle suit peut_acceder_promo.
--   * promo_courante() : un en-tête x-promo-id qui désigne, pour le fondateur, une promo d'un autre organisme que son organisme
--     actif (support échu ou jamais ouvert) rend sa promo par défaut, sans erreur, au lieu de nul. Pour tout autre compte, rien
--     ne change (en-tête refusé : nul).
--   * geste_promo, geste_centre, geste_reseau, mes_promos et lieu_courant gardent leur corps : ils suivent les prédicats
--     ci-dessus (la garde vérifie qu'ils sont bien ceux qu'on croit). Les gestes des contenus communs (contenus.*,
--     case_reseau('cours')) restent jugés sur l'organisme courant : leur réservation au rédacteur est l'étape 2c.
-- Garde : le vocabulaire de l'étape 1 est là ; le corps (md5, retours chariot retirés) de chaque fonction remplacée et de chaque
-- fonction dont le sens est repris tel quel est celui de l'état de la production du 27/11 ; sinon rien n'est changé.
-- Preuve : tests/sql/cloisonnement-preuve.sql, groupes noyau, support, apercu, equivalence-ecf
-- (node outils/assembler_repetition_roles.mjs cloisonnement --etapes 1,2a <sortie>).
-- Retour : 20261128_cloisonnement_2a_noyau_retour.sql (à jouer avant le retour de l'étape 1).
-- À appliquer en une seule transaction, après l'étape 1 :
--   psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261128_cloisonnement_2a_noyau.sql

set local lock_timeout = '3s';

do $garde$
declare
  v_liste text;
begin
  select string_agg(f, ', ') into v_liste
    from unnest(array['public.organisme_de_lieu(integer)', 'public.organisme_de_promo(integer)', 'public.organisme_actif_fondateur()',
                      'public.fondateur_sur(integer)', 'public.organisme_courant()', 'public.est_siege_de(integer)']) f
   where to_regprocedure(f) is null;
  if v_liste is not null then
    raise exception 'cloisonnement_2a : étape 1 absente, fonction(s) : % ; rien n''est changé', v_liste;
  end if;
  select string_agg(x.f || ' (md5 ' || coalesce(md5(replace(p.prosrc, chr(13), '')), 'absente') || ')', ', ') into v_liste
    from (values
      -- Remplacées.
      ('public.est_formateur(integer)', '5918683c9b989897f178d8678538cf3c'),
      ('public.est_direction(integer)', 'dfa48397194177014a8ed6c76f963ff9'),
      ('public.est_siege()', '2d3e4bde728f661ca100c27eaed213e0'),
      ('public.peut_acceder_promo(integer)', '0c90a1bcda2393f7d190838bf58a3f70'),
      ('public.promo_par_defaut()', '314acd28b779a8e4b2433c78f629332e'),
      ('public.promo_courante()', 'd07581de1d2d7ba6df2d45d82a86ea85'),
      ('public.case_promo(integer, text)', '6813c2590ca70b7ba6f29b74a3c5d23b'),
      ('public.case_centre(integer, text)', 'e58ca5c12442fa9bc542f4f50e3f2a67'),
      ('public.case_reseau(text)', 'b391fab933133cb95e5c9660b50e09c5'),
      ('public.siege_fixe()', '039f4850e6b6faa010d5df1a0304dc5c'),
      ('public.formateur_fixe(integer)', '6d16a8d31657cd2a1c8e8300fc3df31f'),
      ('public.direction_fixe(integer)', 'ea6724aa3010a32222ee39442e235f9e'),
      ('public.membre_stagiaire(integer)', 'dc7162627759c52ad3504ea5622c365a'),
      -- Gardées telles quelles : leur sens suit les prédicats remplacés.
      ('public.mes_promos()', 'b540f3a474efd33c6da96a43e98a9fd5'),
      ('public.geste_promo(integer, text)', '195a0bf62a5b9b73c66ac9d9ea1dcc9d'),
      ('public.geste_centre(integer, text)', '14cc691cf0d9049e9c9a052140372da4'),
      ('public.geste_reseau(text)', 'd746b4c94ef274ea02fbf281d10e5b89'),
      ('public.lieu_courant()', 'd236b2e6184caecd392e5962511c82dc'),
      ('public.apercu_role()', '20cda94e10ec18d8819e91f781a3b5b0'),
      ('public.fondateur_reel()', 'c275a072a60fafffbab944893dd500cf')) x(f, attendu)
    left join pg_proc p on p.oid = to_regprocedure(x.f)
   where md5(replace(p.prosrc, chr(13), '')) is distinct from x.attendu;
  if v_liste is not null then
    raise exception 'cloisonnement_2a : corps inattendu(s) : % ; rien n''est changé', v_liste;
  end if;
end $garde$;

-- 1. Formateur d'une promo : le fondateur seulement sur son organisme actif ; en aperçu formateur, la promo affichée de cet organisme.
create or replace function public.est_formateur(p integer)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select case
           when apercu.role is not null then apercu.role = 'formateur' and coalesce(p = promo_courante(), false)
                                             and fondateur_sur(organisme_de_promo(p))
           when fondateur_reel() then fondateur_sur(coalesce(organisme_de_promo(p), organisme_actif_fondateur()))
           else exists (select 1 from affectations af
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and af.role = 'formateur' and af.promo_id = p)
         end
    from (select apercu_role() as role) apercu;
$function$;

-- 2. Direction d'un centre : de même, sur l'organisme du centre.
create or replace function public.est_direction(l integer)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select case
           when apercu.role is not null then apercu.role = 'direction' and coalesce(l = lieu_courant(), false)
                                             and fondateur_sur(organisme_de_lieu(l))
           when fondateur_reel() then fondateur_sur(coalesce(organisme_de_lieu(l), organisme_actif_fondateur()))
           else exists (select 1 from affectations af
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and af.role = 'direction' and af.lieu_id = l)
         end
    from (select apercu_role() as role) apercu;
$function$;

-- 3. Siège : siège de l'organisme courant (est_siege_de) ; l'organisme courant ne se calcule que pour qui peut être siège.
create or replace function public.est_siege()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(case
           when apercu.role is not null then apercu.role = 'siege' and est_siege_de(organisme_courant())
           else (fondateur_reel()
                 or exists (select 1 from affectations af
                             where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                               and af.role = 'siege'))
                and est_siege_de(organisme_courant())
         end, false)
    from (select apercu_role() as role) apercu;
$function$;

-- 4. Accès à une promo : le fondateur, les promos de son organisme actif seulement (sa propre fiche comprise) ; les autres comptes
--    comme avant.
create or replace function public.peut_acceder_promo(p integer)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select exists (select 1 from promos pr where pr.id = p)
     and case
           when fondateur_reel() then fondateur_sur(organisme_de_promo(p))
           else exists (select 1 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
                         where lower(up.email) = lower((select auth.jwt() ->> 'email'))
                           and s.promo_id = p)
             or exists (select 1 from affectations af
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and (   (af.role = 'formateur' and af.promo_id = p)
                                or (af.role = 'direction' and af.lieu_id = lieu_de_promo(p))))
         end;
$function$;

-- 5. Promo par défaut : la promo de la fiche stagiaire seulement si elle est accessible.
create or replace function public.promo_par_defaut()
 returns integer
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  with moi as (
    select up.stagiaire_id
    from user_profiles up
    where lower(up.email) = lower((select auth.jwt() ->> 'email'))
    limit 1
  )
  select coalesce(
    (select s.promo_id from moi join stagiaires s on s.id = moi.stagiaire_id where peut_acceder_promo(s.promo_id)),
    (select pr.id from promos pr
      where peut_acceder_promo(pr.id) and (pr.date_fin is null or pr.date_fin >= current_date)
      order by pr.date_debut, pr.id limit 1),
    (select pr.id from promos pr
      where peut_acceder_promo(pr.id)
      order by pr.date_debut desc, pr.id desc limit 1)
  );
$function$;

-- 6. Promo affichée : l'en-tête d'une promo d'un autre organisme que l'organisme actif du fondateur rend sa promo par défaut.
create or replace function public.promo_courante()
 returns integer
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  brut text := nullif(current_setting('request.headers', true), '');
  entete text;
begin
  -- Aperçu siège : le siège ne voit aucune promo.
  if apercu_role() = 'siege' then
    return null;
  end if;
  if brut is not null then
    -- En-têtes illisibles : aucune promo (PostgREST envoie toujours un JSON valide).
    if not pg_input_is_valid(brut, 'jsonb') then
      return null;
    end if;
    entete := brut::jsonb ->> 'x-promo-id';
  end if;
  if entete is null or entete = '' then
    return promo_par_defaut();
  end if;
  if entete ~ '^[0-9]{1,9}$' and peut_acceder_promo(entete::integer) then
    return entete::integer;
  end if;
  -- Le fondateur dont l'en-tête désigne encore une promo d'un autre organisme (accès support échu ou fermé en cours de
  -- session) : sa promo par défaut, dans son organisme actif.
  if entete ~ '^[0-9]{1,9}$' and fondateur_reel() and organisme_de_promo(entete::integer) is not null
     and organisme_de_promo(entete::integer) is distinct from organisme_actif_fondateur() then
    return promo_par_defaut();
  end if;
  return null;
end;
$function$;

-- 7. Cases d'une promo : le fondateur au plafond sur son organisme actif, rien ailleurs ; l'aperçu formateur de même.
create or replace function public.case_promo(p integer, p_page text)
 returns integer
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((
    select case
             when p is null then 0
             when apercu.role is not null then
               case when apercu.role = 'formateur' and coalesce(p = promo_courante(), false) and fondateur_sur(organisme_de_promo(p))
                    then _case_apercu(p_page, pg.plafond) else 0 end
             when fondateur_reel() then
               case when fondateur_sur(coalesce(organisme_de_promo(p), organisme_actif_fondateur())) then pg.plafond else 0 end
             else coalesce((
               select max(case when t.fixe then pg.plafond
                               else least(pg.plafond, case t.cases ->> p_page when 'voir' then 1 when 'modifier' then 2 else 0 end)
                          end)
                 from affectations af
                 join titres t on t.id = af.titre_id
                where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                  and af.role = 'formateur' and af.promo_id = p), 0)
           end
      from (select apercu_role() as role) apercu
     cross join (select pl.plafond from _pages_du_niveau('promo') pl where pl.page = p_page) pg
  ), 0);
$function$;

-- 8. Cases d'un centre : de même, sur l'organisme du centre.
create or replace function public.case_centre(l integer, p_page text)
 returns integer
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((
    select case
             when l is null then 0
             when apercu.role is not null then
               case when apercu.role = 'direction' and coalesce(l = lieu_courant(), false) and fondateur_sur(organisme_de_lieu(l))
                    then _case_apercu(p_page, pg.plafond) else 0 end
             when fondateur_reel() then
               case when fondateur_sur(coalesce(organisme_de_lieu(l), organisme_actif_fondateur())) then pg.plafond else 0 end
             else coalesce((
               select max(case when t.fixe then pg.plafond
                               else least(pg.plafond, case t.cases ->> p_page when 'voir' then 1 when 'modifier' then 2 else 0 end)
                          end)
                 from affectations af
                 join titres t on t.id = af.titre_id
                where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                  and af.role = 'direction' and af.lieu_id = l), 0)
           end
      from (select apercu_role() as role) apercu
     cross join (select pl.plafond from _pages_du_niveau('centre') pl where pl.page = p_page) pg
  ), 0);
$function$;

-- 9. Cases du réseau : celles de l'organisme courant (affectation siège sur lui ; le fondateur, son organisme actif).
create or replace function public.case_reseau(p_page text)
 returns integer
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((
    select case
             when apercu.role is not null then
               case when apercu.role = 'siege' and fondateur_sur(organisme_courant()) then _case_apercu(p_page, pg.plafond) else 0 end
             when fondateur_reel() then
               case when fondateur_sur(organisme_courant()) then pg.plafond else 0 end
             else coalesce((
               select max(case when t.fixe then pg.plafond
                               else least(pg.plafond, case t.cases ->> p_page when 'voir' then 1 when 'modifier' then 2 else 0 end)
                          end)
                 from affectations af
                 join titres t on t.id = af.titre_id
                where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                  and af.role = 'siege' and af.organisme_id = organisme_courant()), 0)
           end
      from (select apercu_role() as role) apercu
     cross join (select pl.plafond from _pages_du_niveau('reseau') pl where pl.page = p_page) pg
  ), 0);
$function$;

-- 10. Siège au titre fixe : sur l'organisme courant.
create or replace function public.siege_fixe()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(case
           when apercu.role is not null then apercu.role = 'siege' and _apercu_fixe() and fondateur_sur(organisme_courant())
           when fondateur_reel() then fondateur_sur(organisme_courant())
           else exists (select 1 from affectations af join titres t on t.id = af.titre_id
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and af.role = 'siege' and t.fixe and af.organisme_id = organisme_courant())
         end, false)
    from (select apercu_role() as role) apercu;
$function$;

-- 11. Formateur au titre fixe : le fondateur sur son organisme actif.
create or replace function public.formateur_fixe(p integer)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(case
           when p is null then false
           when apercu.role is not null then apercu.role = 'formateur' and coalesce(p = promo_courante(), false) and _apercu_fixe()
                                             and fondateur_sur(organisme_de_promo(p))
           when fondateur_reel() then fondateur_sur(coalesce(organisme_de_promo(p), organisme_actif_fondateur()))
           else exists (select 1 from affectations af join titres t on t.id = af.titre_id
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and af.role = 'formateur' and af.promo_id = p and t.fixe)
         end, false)
    from (select apercu_role() as role) apercu;
$function$;

-- 12. Direction au titre fixe : de même, sur l'organisme du centre.
create or replace function public.direction_fixe(l integer)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(case
           when l is null then false
           when apercu.role is not null then apercu.role = 'direction' and coalesce(l = lieu_courant(), false) and _apercu_fixe()
                                             and fondateur_sur(organisme_de_lieu(l))
           when fondateur_reel() then fondateur_sur(coalesce(organisme_de_lieu(l), organisme_actif_fondateur()))
           else exists (select 1 from affectations af join titres t on t.id = af.titre_id
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and af.role = 'direction' and af.lieu_id = l and t.fixe)
         end, false)
    from (select apercu_role() as role) apercu;
$function$;

-- 13. Membre stagiaire d'une promo : le fondateur, seulement dans son organisme actif (sa propre fiche comprise), aperçu stagiaire
--     compris.
create or replace function public.membre_stagiaire(p integer)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(case
           when p is null then false
           when apercu.role is not null then
             apercu.role = 'stagiaire' and coalesce(p = promo_courante(), false)
             -- l'aperçu stagiaire n'ouvre la lecture qu'à qui pouvait déjà tout lire de cette promo (fondateur de son organisme,
             -- titres fixes) ou y a une vraie fiche : un titre non fixe n'y gagne rien.
             and (case
                    when fondateur_reel() then fondateur_sur(organisme_de_promo(p))
                    else exists (select 1 from affectations af join titres t on t.id = af.titre_id
                                  where lower(af.email) = lower((select auth.jwt() ->> 'email')) and t.fixe
                                    and ((af.role = 'formateur' and af.promo_id = p)
                                         or (af.role = 'direction' and af.lieu_id = lieu_de_promo(p))))
                      or exists (select 1 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
                                  where lower(up.email) = lower((select auth.jwt() ->> 'email')) and s.promo_id = p)
                  end)
           when fondateur_reel() then
             fondateur_sur(organisme_de_promo(p))
             and exists (select 1 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
                          where lower(up.email) = lower((select auth.jwt() ->> 'email')) and s.promo_id = p)
           else exists (select 1 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
                         where lower(up.email) = lower((select auth.jwt() ->> 'email')) and s.promo_id = p)
         end, false)
    from (select apercu_role() as role) apercu;
$function$;
