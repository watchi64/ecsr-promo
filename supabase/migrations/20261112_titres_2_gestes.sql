-- Titres et droits à la carte, étape 1, migration 2. Partie A : le vocabulaire des cases et des gestes (aucune règle ni aucune fonction
-- existante ne change). Partie B (en fin de fichier) : 29 fonctions de l'app, qui décidaient d'un droit par l'ancien prédicat, passent par
-- les gestes ; avec les seuls titres fixes d'aujourd'hui, chacune répond comme avant (même signature, même retour, mêmes phrases de
-- refus, mêmes droits d'exécution), sauf notes_stats_groupe qui reçoit une garde (nul sans « Notes et examens », décision T4).
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
-- Si une même personne a plusieurs lignes au même niveau (adresse écrite deux fois, à la casse près), la case la plus large l'emporte
-- (comme l'ancien « ou »), jamais d'erreur.
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

-- 6. Partie B : 29 fonctions passent par les gestes -----------------------------------------------------------------------------
-- Chaque fonction est redéfinie à partir de sa définition en base au moment de l'exécution (pg_get_functiondef), par remplacement
-- de fragments, chacun attendu exactement une fois (garde : formateur_courant() ou equipe_courante() devient geste_promo(promo_courante(),
-- code), l'ancien prédicat sur une promo devient geste_promo(p, code), est_direction(l) devient geste_centre(l, code), est_siege()
-- devient geste_reseau(code)). Un seul bloc : un fragment manquant ou en double annule tout, rien n'est changé. Les droits
-- d'exécution ne bougent pas (create or replace). inviter_compte garde est_fondateur() pour la branche siège.
-- Codes : emargement.tenir (emargement_feuille, _ouvrir, _signer) ; stagiaires.gerer (set_date_naissance, a_une_affectation, inviter_compte
-- branche stagiaire) ; anonymiser (anonymiser_stagiaire, anonymiser_promo et etat_anonymisation_promo, avec ou sans argument) ;
-- benevoles.lire (venues_benevoles) ; benevoles.purger (benevoles_a_purger(), purger_benevoles(ids)) ; donnees.purger (les deux versions
-- du centre) ; notes.lire (notes_stagiaires_visibles, epcf_moyennes, notes_stats_groupe) ; contenus.traiter (accepter_brouillon_ia,
-- rejeter_brouillon_ia, is_admin, is_prof) ; promos.gerer (creer_promo, modifier_dates_promo) ; reglages.modifier (habillages du centre
-- et du réseau) ; formateurs.nommer (regler_affectations_formateur, inviter_compte branche formateur) ; centres.creer (creer_centre) ;
-- directions.nommer (inviter_compte branche direction).
-- Une seule différence de texte hors garde : set_date_naissance lit « stagiaire concerné » avec coalesce(..., false). Sans fiche dans la promo
-- affichée, my_stagiaire_id() est nul et « non (faux ou nul) » est nul : l'ancienne fonction laissait passer. Le cas est atteignable
-- aujourd'hui par le fondateur en aperçu (stagiaire, ou siège avec promo) sur une promo où il n'a pas de fiche : il pouvait écrire la date de
-- naissance de n'importe quel stagiaire ; il est désormais refusé, comme l'aperçu stagiaire doit le faire. Aucun autre compte n'est touché.

do $migration$
declare
  v_fonctions regprocedure[] := array[
    'public.a_une_affectation(text)'::regprocedure,
    'public.accepter_brouillon_ia(bigint, text, text, text, jsonb)'::regprocedure,
    'public.rejeter_brouillon_ia(bigint)'::regprocedure,
    'public.anonymiser_promo()'::regprocedure,
    'public.etat_anonymisation_promo()'::regprocedure,
    'public.anonymiser_stagiaire(integer)'::regprocedure,
    'public.anonymiser_promo(integer)'::regprocedure,
    'public.etat_anonymisation_promo(integer)'::regprocedure,
    'public.benevoles_a_purger()'::regprocedure,
    'public.benevoles_a_purger(integer)'::regprocedure,
    'public.purger_benevoles(integer[])'::regprocedure,
    'public.purger_benevoles(integer[], integer)'::regprocedure,
    'public.venues_benevoles()'::regprocedure,
    'public.notes_stagiaires_visibles()'::regprocedure,
    'public.epcf_moyennes(text)'::regprocedure,
    'public.notes_stats_groupe()'::regprocedure,
    'public.set_date_naissance(integer, date)'::regprocedure,
    'public.emargement_feuille(bigint, boolean)'::regprocedure,
    'public.emargement_ouvrir(text, text, text)'::regprocedure,
    'public.emargement_signer(bigint, integer, text)'::regprocedure,
    'public.is_admin()'::regprocedure,
    'public.is_prof()'::regprocedure,
    'public.creer_promo(integer, text, date, date)'::regprocedure,
    'public.modifier_dates_promo(integer, date, date)'::regprocedure,
    'public.regler_habillage_centre(integer, text, boolean)'::regprocedure,
    'public.regler_habillage_reseau(text)'::regprocedure,
    'public.creer_centre(text)'::regprocedure,
    'public.regler_affectations_formateur(text, integer, integer[], integer)'::regprocedure,
    'public.inviter_compte(text, text, integer, integer, integer)'::regprocedure];
  -- La fonction de chaque fragment (rang dans v_fonctions).
  v_de integer[] := array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 29, 29];
  v_anciens text[] := array[
$ancien$(select public.equipe_courante())$ancien$,
$ancien$if not formateur_courant() then$ancien$,
$ancien$if not formateur_courant() then$ancien$,
$ancien$if not equipe_courante() then$ancien$,
$ancien$if not equipe_courante() then$ancien$,
$ancien$if not equipe_courante() then$ancien$,
$ancien$if not (coalesce(est_formateur(p_promo), false) or coalesce(est_direction(lieu_de_promo(p_promo)), false)) then$ancien$,
$ancien$if not (coalesce(est_formateur(p_promo), false) or coalesce(est_direction(lieu_de_promo(p_promo)), false)) then$ancien$,
$ancien$where formateur_courant()$ancien$,
$ancien$if not coalesce(est_direction(p_lieu), false) then$ancien$,
$ancien$if not formateur_courant() then$ancien$,
$ancien$if not coalesce(est_direction(p_lieu), false) then$ancien$,
$ancien$where equipe_courante()$ancien$,
$ancien$       equipe_courante()
$ancien$,
$ancien$(select public.equipe_courante())$ancien$,
$ancien$  select jsonb_build_object(
    'n_lignes'$ancien$,
$ancien$(select min(moy) from par_stagiaire)
  );
$ancien$,
$ancien$if not (equipe_courante() or p_stagiaire_id = my_stagiaire_id()) then$ancien$,
$ancien$if p_formateur and not formateur_courant() then$ancien$,
$ancien$if not formateur_courant() then$ancien$,
$ancien$elsif formateur_courant() then$ancien$,
$ancien$select formateur_courant();$ancien$,
$ancien$select formateur_courant();$ancien$,
$ancien$or not est_direction(p_lieu_id) then$ancien$,
$ancien$or not est_direction(lieu_de_promo(p_promo_id)) then$ancien$,
$ancien$or not coalesce(est_direction(p_lieu_id), false) then$ancien$,
$ancien$or not coalesce(est_siege(), false) then$ancien$,
$ancien$if not coalesce((select est_siege()), false) then$ancien$,
$ancien$or not coalesce(est_direction(p_lieu_id), false) then$ancien$,
$ancien$if v_promo_fiche is null or not (est_formateur(v_promo_fiche) or est_direction(lieu_de_promo(v_promo_fiche))) then$ancien$,
$ancien$if v_promo is null or not est_direction(lieu_de_promo(v_promo)) then$ancien$,
$ancien$    if not est_siege() then
$ancien$];
  v_nouveaux text[] := array[
$nouveau$(select public.geste_promo(promo_courante(), 'stagiaires.gerer'))$nouveau$,
$nouveau$if not geste_promo(promo_courante(), 'contenus.traiter') then$nouveau$,
$nouveau$if not geste_promo(promo_courante(), 'contenus.traiter') then$nouveau$,
$nouveau$if not geste_promo(promo_courante(), 'anonymiser') then$nouveau$,
$nouveau$if not geste_promo(promo_courante(), 'anonymiser') then$nouveau$,
$nouveau$if not geste_promo(promo_courante(), 'anonymiser') then$nouveau$,
$nouveau$if not geste_promo(p_promo, 'anonymiser') then$nouveau$,
$nouveau$if not geste_promo(p_promo, 'anonymiser') then$nouveau$,
$nouveau$where (select public.geste_promo(promo_courante(), 'benevoles.purger'))$nouveau$,
$nouveau$if not geste_centre(p_lieu, 'donnees.purger') then$nouveau$,
$nouveau$if not geste_promo(promo_courante(), 'benevoles.purger') then$nouveau$,
$nouveau$if not geste_centre(p_lieu, 'donnees.purger') then$nouveau$,
$nouveau$where (select public.geste_promo(promo_courante(), 'benevoles.lire'))$nouveau$,
$nouveau$       (select public.geste_promo(promo_courante(), 'notes.lire'))
$nouveau$,
$nouveau$(select public.geste_promo(promo_courante(), 'notes.lire'))$nouveau$,
$nouveau$  select case when membre_stagiaire(promo_courante()) or geste_promo(promo_courante(), 'notes.lire') then jsonb_build_object(
    'n_lignes'$nouveau$,
$nouveau$(select min(moy) from par_stagiaire)
  ) end;
$nouveau$,
$nouveau$if not (geste_promo(promo_courante(), 'stagiaires.gerer') or coalesce(p_stagiaire_id = my_stagiaire_id(), false)) then$nouveau$,
$nouveau$if p_formateur and not geste_promo(promo_courante(), 'emargement.tenir') then$nouveau$,
$nouveau$if not geste_promo(promo_courante(), 'emargement.tenir') then$nouveau$,
$nouveau$elsif geste_promo(promo_courante(), 'emargement.tenir') then$nouveau$,
$nouveau$select geste_promo(promo_courante(), 'contenus.traiter');$nouveau$,
$nouveau$select geste_promo(promo_courante(), 'contenus.traiter');$nouveau$,
$nouveau$or not geste_centre(p_lieu_id, 'promos.gerer') then$nouveau$,
$nouveau$or not geste_centre(lieu_de_promo(p_promo_id), 'promos.gerer') then$nouveau$,
$nouveau$or not geste_centre(p_lieu_id, 'reglages.modifier') then$nouveau$,
$nouveau$or not geste_reseau('reglages.modifier') then$nouveau$,
$nouveau$if not coalesce((select geste_reseau('centres.creer')), false) then$nouveau$,
$nouveau$or not geste_centre(p_lieu_id, 'formateurs.nommer') then$nouveau$,
$nouveau$if v_promo_fiche is null or not geste_promo(v_promo_fiche, 'stagiaires.gerer') then$nouveau$,
$nouveau$if v_promo is null or not geste_centre(lieu_de_promo(v_promo), 'formateurs.nommer') then$nouveau$,
$nouveau$    if not geste_reseau('directions.nommer') then
$nouveau$];
  f integer;
  i integer;
  v_def text;
  v_ancien text;
  v_nouveau text;
  n integer;
begin
  -- Le bloc est atomique : un seul fragment manquant ou en double annule tout, rien n'est changé.
  for f in 1..cardinality(v_fonctions) loop
    v_def := pg_get_functiondef(v_fonctions[f]);
    for i in 1..cardinality(v_de) loop
      if v_de[i] <> f then continue; end if;
      v_ancien := v_anciens[i];
      v_nouveau := v_nouveaux[i];
      -- Une définition posée depuis un fichier à fins de ligne Windows garde ses retours chariot : les fragments suivent.
      if position(E'\r' in v_def) > 0 then
        v_ancien := replace(v_ancien, E'\n', E'\r\n');
        v_nouveau := replace(v_nouveau, E'\n', E'\r\n');
      end if;
      n := (length(v_def) - length(replace(v_def, v_ancien, ''))) / length(v_ancien);
      if n <> 1 then
        raise exception 'titres_2_gestes : le fragment % attendu dans % est présent % fois (une seule attendue) ; rien n''est changé', i, v_fonctions[f]::text, n;
      end if;
      v_def := replace(v_def, v_ancien, v_nouveau);
    end loop;
    execute v_def;
  end loop;
end
$migration$;
