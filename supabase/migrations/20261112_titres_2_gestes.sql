-- Titres et droits à la carte, étape 1, migration 2, partie A (invisible : aucune règle ni aucune fonction existante ne change) :
-- le vocabulaire des cases et des gestes, que liront les règles et les fonctions de la partie B et de la migration 3.
--   case_promo(p, page)     la case de la page, pour la promo p : 0 Non, 1 Voir, 2 Modifier. Le titre de la ligne formateur de
--   case_centre(l, page)    l'appelant sur p (resp. direction sur le centre l, siège) ; un titre fixe donne le plafond de la page ;
--   case_reseau(page)       un titre non fixe donne sa case, bornée par le plafond ; rien : 0. Jamais nul. Le fondateur a le
--                           plafond. En aperçu, seul le rôle simulé compte, sur la promo ou le centre affichés (rôle formateur
--                           sur p = promo_courante(), direction sur l = lieu_courant(), siège), et il a le plafond ; tout autre
--                           aperçu : 0 (aperçu stagiaire compris).
--   formateur_fixe(p)       vrai si la personne porte le titre fixe sur p (resp. direction_fixe(l), siege_fixe()) : même forme,
--   direction_fixe(l)       titre fixe seul. Les gestes définitifs et les droits sans page restent à ces titres.
--   siege_fixe()
--   membre_stagiaire(p)     vrai si l'appelant est stagiaire de la promo p : sans aperçu, une fiche de l'appelant dans p ; en
--                           aperçu stagiaire, p = promo_courante() et (fondateur, titre fixe sur p ou son centre, ou fiche dans p). Ce que lit aujourd'hui un stagiaire par les lectures « P ».
--   geste_promo(p, code)    les gestes des tables 1.1 et 1.2 du plan, un « case » par code. Un code inconnu lève l'état 22023
--   geste_centre(l, code)   (une faute de frappe dans une règle échoue au lieu de fermer en silence). Jamais nul. p ou l nul : faux,
--   geste_reseau(code)      sauf la partie « réseau » de contenus.lire_internes et de contenus.rediger : le siège lit et rédige les
--                           contenus communs sans promo affichée (comme est_siege() aujourd'hui, en aperçu siège compris).
-- Toutes stable, security definer, search_path public puis pg_temp ; l'appelant est l'adresse du jeton, comparée en minuscules ;
-- exécution accordée à anon et authenticated comme les fonctions du lot 4. Le retour (20261112_titres_2_gestes_retour.sql) les retire.
set local lock_timeout = '3s';

-- 1. Les cases ---------------------------------------------------------------------------------------------------------------
create function public.case_promo(p integer, p_page text)
returns integer language sql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
  select coalesce((
    select case
             when p is null then 0
             when apercu.role is not null then
               case when apercu.role = 'formateur' and coalesce(p = promo_courante(), false) then pg.plafond else 0 end
             when fondateur_reel() then pg.plafond
             else coalesce((
               select case when t.fixe then pg.plafond
                           else least(pg.plafond, case t.cases ->> p_page when 'voir' then 1 when 'modifier' then 2 else 0 end)
                      end
                 from affectations af
                 join titres t on t.id = af.titre_id
                where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                  and af.role = 'formateur' and af.promo_id = p), 0)
           end
      from (select apercu_role() as role) apercu
     cross join (select pl.plafond from _pages_du_niveau('promo') pl where pl.page = p_page) pg
  ), 0);
$f$;

create function public.case_centre(l integer, p_page text)
returns integer language sql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
  select coalesce((
    select case
             when l is null then 0
             when apercu.role is not null then
               case when apercu.role = 'direction' and coalesce(l = lieu_courant(), false) then pg.plafond else 0 end
             when fondateur_reel() then pg.plafond
             else coalesce((
               select case when t.fixe then pg.plafond
                           else least(pg.plafond, case t.cases ->> p_page when 'voir' then 1 when 'modifier' then 2 else 0 end)
                      end
                 from affectations af
                 join titres t on t.id = af.titre_id
                where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                  and af.role = 'direction' and af.lieu_id = l), 0)
           end
      from (select apercu_role() as role) apercu
     cross join (select pl.plafond from _pages_du_niveau('centre') pl where pl.page = p_page) pg
  ), 0);
$f$;

create function public.case_reseau(p_page text)
returns integer language sql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
  select coalesce((
    select case
             when apercu.role is not null then
               case when apercu.role = 'siege' then pg.plafond else 0 end
             when fondateur_reel() then pg.plafond
             else coalesce((
               select case when t.fixe then pg.plafond
                           else least(pg.plafond, case t.cases ->> p_page when 'voir' then 1 when 'modifier' then 2 else 0 end)
                      end
                 from affectations af
                 join titres t on t.id = af.titre_id
                where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                  and af.role = 'siege'), 0)
           end
      from (select apercu_role() as role) apercu
     cross join (select pl.plafond from _pages_du_niveau('reseau') pl where pl.page = p_page) pg
  ), 0);
$f$;

-- 2. Les titres fixes seuls --------------------------------------------------------------------------------------------------
create function public.formateur_fixe(p integer)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
  select coalesce(case
           when p is null then false
           when apercu.role is not null then apercu.role = 'formateur' and coalesce(p = promo_courante(), false)
           else fondateur_reel()
             or exists (select 1 from affectations af join titres t on t.id = af.titre_id
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and af.role = 'formateur' and af.promo_id = p and t.fixe)
         end, false)
    from (select apercu_role() as role) apercu;
$f$;

create function public.direction_fixe(l integer)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
  select coalesce(case
           when l is null then false
           when apercu.role is not null then apercu.role = 'direction' and coalesce(l = lieu_courant(), false)
           else fondateur_reel()
             or exists (select 1 from affectations af join titres t on t.id = af.titre_id
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and af.role = 'direction' and af.lieu_id = l and t.fixe)
         end, false)
    from (select apercu_role() as role) apercu;
$f$;

create function public.siege_fixe()
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
  select coalesce(case
           when apercu.role is not null then apercu.role = 'siege'
           else fondateur_reel()
             or exists (select 1 from affectations af join titres t on t.id = af.titre_id
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and af.role = 'siege' and t.fixe)
         end, false)
    from (select apercu_role() as role) apercu;
$f$;

-- 3. Le stagiaire de la promo ------------------------------------------------------------------------------------------------
create function public.membre_stagiaire(p integer)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
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
$f$;

-- 4. Les gestes --------------------------------------------------------------------------------------------------------------
-- Table 1.1 du plan. Les cases : case_promo(p, ...) pour la promo, case_centre(l, ...) pour le centre de p (l), case_reseau(...)
-- pour le réseau ; les titres fixes : formateur_fixe(p), direction_fixe(l).
create function public.geste_promo(p integer, p_geste text)
returns boolean language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
declare
  l integer := lieu_de_promo(p);
begin
  case p_geste
    when 'planning.lire' then
      return coalesce(case_promo(p, 'planning') >= 1 or direction_fixe(l), false);
    when 'planning.modifier' then
      return coalesce(case_promo(p, 'planning') = 2, false);
    when 'emargement.lire' then
      return coalesce(case_promo(p, 'emargement') >= 1 or case_centre(l, 'emargement') >= 1, false);
    when 'emargement.tenir' then
      return coalesce(case_promo(p, 'emargement') = 2, false);
    when 'stagiaires.lire' then
      return coalesce(case_promo(p, 'stagiaires') >= 1 or case_centre(l, 'stagiaires') >= 1, false);
    when 'stagiaires.gerer' then
      return coalesce(case_promo(p, 'stagiaires') = 2 or case_centre(l, 'stagiaires') = 2, false);
    when 'stagiaires.supprimer' then
      return coalesce(formateur_fixe(p), false);
    when 'anonymiser' then
      return coalesce(formateur_fixe(p) or direction_fixe(l), false);
    when 'benevoles.lire' then
      return coalesce(case_promo(p, 'stagiaires') >= 1 or direction_fixe(l), false);
    when 'benevoles.gerer' then
      return coalesce(case_promo(p, 'stagiaires') = 2, false);
    when 'benevoles.purger' then
      return coalesce(formateur_fixe(p), false);
    when 'notes.lire' then
      return coalesce(case_promo(p, 'notes') >= 1 or case_centre(l, 'notes') >= 1, false);
    when 'notes.saisir' then
      return coalesce(case_promo(p, 'notes') = 2, false);
    when 'contenus.lire_internes' then
      return coalesce(case_promo(p, 'cours') >= 1 or direction_fixe(l) or case_reseau('cours') >= 1, false);
    when 'contenus.rediger' then
      return coalesce(case_promo(p, 'cours') = 2 or case_reseau('cours') = 2, false);
    when 'referentiel.modifier' then
      return coalesce(case_promo(p, 'cours') = 2, false);
    when 'contenus.traiter' then
      return coalesce(case_promo(p, 'cours') = 2, false);
    when 'reglages.modifier' then
      return coalesce(case_promo(p, 'reglages') = 2, false);
    when 'modules.modifier' then
      return coalesce(case_promo(p, 'reglages') = 2 or case_centre(l, 'promos') = 2, false);
    when 'promo.renommer' then
      return coalesce(case_promo(p, 'reglages') = 2 or case_centre(l, 'promos') = 2, false);
    when 'fiches_internes.ecrire' then
      return coalesce(formateur_fixe(p) or direction_fixe(l), false);
    else
      raise exception 'titres: geste inconnu « % »', p_geste using errcode = '22023';
  end case;
end $f$;

-- Table 1.2 du plan.
create function public.geste_centre(l integer, p_geste text)
returns boolean language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
begin
  case p_geste
    when 'promos.gerer' then
      return coalesce(case_centre(l, 'promos') = 2, false);
    when 'reglages.modifier' then
      return coalesce(case_centre(l, 'reglages') = 2, false);
    when 'donnees.purger' then
      return coalesce(direction_fixe(l), false);
    when 'formateurs.nommer' then
      return coalesce(direction_fixe(l), false);
    when 'equipe.lire' then
      return coalesce(case_centre(l, 'equipe') >= 1, false);
    else
      raise exception 'titres: geste inconnu « % »', p_geste using errcode = '22023';
  end case;
end $f$;

create function public.geste_reseau(p_geste text)
returns boolean language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
begin
  case p_geste
    when 'centres.creer' then
      return coalesce(case_reseau('directions') = 2, false);
    when 'directions.nommer' then
      return coalesce(siege_fixe(), false);
    when 'directions.lire' then
      return coalesce(case_reseau('directions') >= 1, false);
    when 'reglages.modifier' then
      return coalesce(case_reseau('reglages') = 2, false);
    else
      raise exception 'titres: geste inconnu « % »', p_geste using errcode = '22023';
  end case;
end $f$;

-- 5. Droits d'exécution : comme les fonctions du lot 4 (une règle ou une fonction de l'app les appelle directement).
revoke all on function public.case_promo(integer, text), public.case_centre(integer, text), public.case_reseau(text),
  public.formateur_fixe(integer), public.direction_fixe(integer), public.siege_fixe(), public.membre_stagiaire(integer),
  public.geste_promo(integer, text), public.geste_centre(integer, text), public.geste_reseau(text) from public;
grant execute on function public.case_promo(integer, text), public.case_centre(integer, text), public.case_reseau(text),
  public.formateur_fixe(integer), public.direction_fixe(integer), public.siege_fixe(), public.membre_stagiaire(integer),
  public.geste_promo(integer, text), public.geste_centre(integer, text), public.geste_reseau(text) to anon, authenticated;
