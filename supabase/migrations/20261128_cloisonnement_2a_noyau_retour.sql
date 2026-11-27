-- Retour de 20261128_cloisonnement_2a_noyau : remet le corps d'avant (état de la production du 27/11) de chaque fonction que
-- l'étape 2a a remplacée. Mêmes signatures, mêmes droits (create or replace). Rend exactement l'empreinte d'avant l'étape 2a
-- (tests/sql/roles-empreinte.sql : règles, fonctions, droits).
-- Garde : chaque corps est celui que l'étape 2a a posé (md5, retours chariot retirés) ; sinon rien n'est changé.
-- Ordre : après les retours des étapes 2c et 2b, avant celui de l'étape 1 (les corps de l'étape 2a appellent le vocabulaire
-- de l'étape 1).
-- Preuve : tests/sql/cloisonnement-preuve.sql, groupe retour.
-- À appliquer en une seule transaction :
--   psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261128_cloisonnement_2a_noyau_retour.sql

set local lock_timeout = '3s';

do $garde$
declare
  v_liste text;
begin
  select string_agg(x.f || ' (md5 ' || coalesce(md5(replace(p.prosrc, chr(13), '')), 'absente') || ')', ', ') into v_liste
    from (values
      ('public.est_formateur(integer)', '56a4b23692a78fd5e149c829a5ff9cdb'),
      ('public.est_direction(integer)', 'e1341635b5d5a9ea252519fa3185245f'),
      ('public.est_siege()', '03ab8d1c738827dc5ab5157b92218ce7'),
      ('public.peut_acceder_promo(integer)', 'e39a7d18dbaf5f8ef650893e70c84e7e'),
      ('public.promo_par_defaut()', 'ac16be27205d0a3a276a33c7a4ebb5a7'),
      ('public.promo_courante()', 'd29169c063f6da3d97bf95f8e0d83b18'),
      ('public.case_promo(integer, text)', 'b1f29236f7572342eb10b94444049cfb'),
      ('public.case_centre(integer, text)', '355985c6b641ec4c3031779633b13deb'),
      ('public.case_reseau(text)', '1394175eafc6b032c74c08b34bfa723d'),
      ('public.siege_fixe()', '322b0828ae90625915e5675f0cf89649'),
      ('public.formateur_fixe(integer)', '32abaaf5441c587cec8bdc8a6ddf1280'),
      ('public.direction_fixe(integer)', '579df8cd34e81bc559362e603fc9ef28'),
      ('public.membre_stagiaire(integer)', '063cfe47b7f5bd67952b574ca81708e4')) x(f, attendu)
    left join pg_proc p on p.oid = to_regprocedure(x.f)
   where md5(replace(p.prosrc, chr(13), '')) is distinct from x.attendu;
  if v_liste is not null then
    raise exception 'cloisonnement_2a_retour : corps inattendu(s) : % ; rien n''est changé', v_liste;
  end if;
end $garde$;

-- Les corps d'avant, tels que la base les rend (pg_get_functiondef), dans l'ordre de l'étape 2a.
CREATE OR REPLACE FUNCTION public.est_formateur(p integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
           when apercu.role is not null then apercu.role = 'formateur' and coalesce(p = promo_courante(), false)
           else fondateur_reel()
             or exists (select 1 from affectations af
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and af.role = 'formateur' and af.promo_id = p)
         end
    from (select apercu_role() as role) apercu;
$function$
;

CREATE OR REPLACE FUNCTION public.est_direction(l integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
           when apercu.role is not null then apercu.role = 'direction' and coalesce(l = lieu_courant(), false)
           else fondateur_reel()
             or exists (select 1 from affectations af
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and af.role = 'direction' and af.lieu_id = l)
         end
    from (select apercu_role() as role) apercu;
$function$
;

CREATE OR REPLACE FUNCTION public.est_siege()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
           when apercu.role is not null then apercu.role = 'siege'
           else fondateur_reel()
             or exists (select 1 from affectations af
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and af.role = 'siege')
         end
    from (select apercu_role() as role) apercu;
$function$
;

CREATE OR REPLACE FUNCTION public.peut_acceder_promo(p integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (select 1 from promos pr where pr.id = p)
     and (
          fondateur_reel()
       or exists (select 1 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
                   where lower(up.email) = lower((select auth.jwt() ->> 'email'))
                     and s.promo_id = p)
       or exists (select 1 from affectations af
                   where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                     and (   (af.role = 'formateur' and af.promo_id = p)
                          or (af.role = 'direction' and af.lieu_id = lieu_de_promo(p))))
     );
$function$
;

CREATE OR REPLACE FUNCTION public.promo_par_defaut()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with moi as (
    select up.stagiaire_id
    from user_profiles up
    where lower(up.email) = lower((select auth.jwt() ->> 'email'))
    limit 1
  )
  select coalesce(
    (select s.promo_id from moi join stagiaires s on s.id = moi.stagiaire_id),
    (select pr.id from promos pr
      where peut_acceder_promo(pr.id) and (pr.date_fin is null or pr.date_fin >= current_date)
      order by pr.date_debut, pr.id limit 1),
    (select pr.id from promos pr
      where peut_acceder_promo(pr.id)
      order by pr.date_debut desc, pr.id desc limit 1)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.promo_courante()
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.case_promo(p integer, p_page text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce((
    select case
             when p is null then 0
             when apercu.role is not null then
               case when apercu.role = 'formateur' and coalesce(p = promo_courante(), false) then _case_apercu(p_page, pg.plafond) else 0 end
             when fondateur_reel() then pg.plafond
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
$function$
;

CREATE OR REPLACE FUNCTION public.case_centre(l integer, p_page text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce((
    select case
             when l is null then 0
             when apercu.role is not null then
               case when apercu.role = 'direction' and coalesce(l = lieu_courant(), false) then _case_apercu(p_page, pg.plafond) else 0 end
             when fondateur_reel() then pg.plafond
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
$function$
;

CREATE OR REPLACE FUNCTION public.case_reseau(p_page text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce((
    select case
             when apercu.role is not null then
               case when apercu.role = 'siege' then _case_apercu(p_page, pg.plafond) else 0 end
             when fondateur_reel() then pg.plafond
             else coalesce((
               select max(case when t.fixe then pg.plafond
                               else least(pg.plafond, case t.cases ->> p_page when 'voir' then 1 when 'modifier' then 2 else 0 end)
                          end)
                 from affectations af
                 join titres t on t.id = af.titre_id
                where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                  and af.role = 'siege'), 0)
           end
      from (select apercu_role() as role) apercu
     cross join (select pl.plafond from _pages_du_niveau('reseau') pl where pl.page = p_page) pg
  ), 0);
$function$
;

CREATE OR REPLACE FUNCTION public.siege_fixe()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(case
           when apercu.role is not null then apercu.role = 'siege' and _apercu_fixe()
           else fondateur_reel()
             or exists (select 1 from affectations af join titres t on t.id = af.titre_id
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and af.role = 'siege' and t.fixe)
         end, false)
    from (select apercu_role() as role) apercu;
$function$
;

CREATE OR REPLACE FUNCTION public.formateur_fixe(p integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(case
           when p is null then false
           when apercu.role is not null then apercu.role = 'formateur' and coalesce(p = promo_courante(), false) and _apercu_fixe()
           else fondateur_reel()
             or exists (select 1 from affectations af join titres t on t.id = af.titre_id
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and af.role = 'formateur' and af.promo_id = p and t.fixe)
         end, false)
    from (select apercu_role() as role) apercu;
$function$
;

CREATE OR REPLACE FUNCTION public.direction_fixe(l integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(case
           when l is null then false
           when apercu.role is not null then apercu.role = 'direction' and coalesce(l = lieu_courant(), false) and _apercu_fixe()
           else fondateur_reel()
             or exists (select 1 from affectations af join titres t on t.id = af.titre_id
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and af.role = 'direction' and af.lieu_id = l and t.fixe)
         end, false)
    from (select apercu_role() as role) apercu;
$function$
;

CREATE OR REPLACE FUNCTION public.membre_stagiaire(p integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(case
           when p is null then false
           when apercu.role is not null then
             apercu.role = 'stagiaire' and coalesce(p = promo_courante(), false)
             -- l'aperçu stagiaire n'ouvre la lecture qu'à qui pouvait déjà tout lire de cette promo (fondateur, titres fixes) ou
             -- y a une vraie fiche : un titre non fixe n'y gagne rien.
             and (fondateur_reel()
                  or exists (select 1 from affectations af join titres t on t.id = af.titre_id
                              where lower(af.email) = lower((select auth.jwt() ->> 'email')) and t.fixe
                                and ((af.role = 'formateur' and af.promo_id = p)
                                     or (af.role = 'direction' and af.lieu_id = lieu_de_promo(p))))
                  or exists (select 1 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
                              where lower(up.email) = lower((select auth.jwt() ->> 'email')) and s.promo_id = p))
           else exists (select 1 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
                         where lower(up.email) = lower((select auth.jwt() ->> 'email')) and s.promo_id = p)
         end, false)
    from (select apercu_role() as role) apercu;
$function$
;
