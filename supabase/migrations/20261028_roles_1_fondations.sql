-- Lot 4 (rôles et portées), étape 1 : fondations. INVISIBLE : aucune règle existante ne change, aucune fonction
-- existante n'est touchée, aucun compte ne voit ni ne peut rien de plus ni de moins qu'avant. Les étapes 2 (fonctions)
-- et 3 (règles) s'appuieront sur ce qui est posé ici.
--   1. La table affectations : les rôles d'équipe et leur portée (formateur d'une promo, direction d'un lieu, siège
--      du réseau). Le stagiaire reste sur sa fiche (user_profiles.stagiaire_id), le fondateur sur
--      user_profiles.is_founder ; les rôles se cumulent (une directrice qui forme a deux lignes).
--   2. Le vocabulaire des rôles, que liront les règles. L'aperçu (en-tête x-apercu-role) ne fait que retirer des
--      droits : stagiaire vaut pour tout compte ; formateur, direction et siege pour le seul fondateur, qui n'a alors
--      que les droits du rôle simulé, sur la promo affichée.
--   3. Les droits et les trois règles de la table affectations.
--   4. L'amorce : les formateurs actuels (role = 'prof' et is_admin) voient aujourd'hui toutes les promos ; ils en
--      deviennent formateurs, promo par promo (relevé du 28/10 : 3 comptes, promos 1, 2 et 7, soit 9 lignes).
-- Marche arrière : 20261028_roles_1_fondations_retour.sql. Preuve : tests/sql/roles-1-preuve.sql, assemblée par
-- outils/assembler_repetition_roles.mjs (mode etape-1).
set local lock_timeout = '3s';

-- 1. La table ------------------------------------------------------------------------------------------------------
create table public.affectations (
  id bigint generated always as identity primary key,
  email text not null references public.user_profiles(email) on update cascade on delete cascade,
  role text not null check (role in ('formateur', 'direction', 'siege')),
  promo_id integer references public.promos(id) on delete cascade,
  lieu_id integer references public.lieux(id) on delete cascade,
  cree_le timestamptz not null default now(),
  cree_par text default lower(auth.jwt() ->> 'email'),
  -- Portée : un formateur l'est d'une promo, une direction d'un lieu, le siège de tout le réseau.
  constraint affectations_portee check (
       (role = 'formateur' and promo_id is not null and lieu_id is null)
    or (role = 'direction' and promo_id is null and lieu_id is not null)
    or (role = 'siege' and promo_id is null and lieu_id is null)),
  -- Une affectation ne s'écrit qu'une fois, siège compris (nulls not distinct). L'index de cette contrainte commence
  -- par email : il sert aussi de recherche par compte, sans index à part.
  constraint affectations_unique unique nulls not distinct (email, role, promo_id, lieu_id)
);
create index affectations_promo_idx on public.affectations (promo_id);
create index affectations_lieu_idx on public.affectations (lieu_id);

-- 2. Le vocabulaire ------------------------------------------------------------------------------------------------
-- Toutes stable, security definer, search_path public puis pg_temp ; l'appelant est l'email du jeton, comparé en
-- minuscules.

-- Le fondateur, aperçu ou non. Interne : aucun droit d'exécution public.
create function public.fondateur_reel()
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from user_profiles up
    where lower(up.email) = lower((select auth.jwt() ->> 'email'))
      and up.is_founder
  );
$function$;

-- Le rôle simulé par l'en-tête x-apercu-role, lu comme promo_courante() lit x-promo-id : stagiaire pour tout compte ;
-- formateur, direction et siege pour le seul fondateur ; nul sans en-tête, en-têtes illisibles, valeur inconnue ou
-- refusée. Interne : aucun droit d'exécution public.
create function public.apercu_role()
returns text language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  brut text := nullif(current_setting('request.headers', true), '');
  entete text;
begin
  -- En-têtes illisibles : aucun aperçu (PostgREST envoie toujours un JSON valide).
  if brut is null or not pg_input_is_valid(brut, 'jsonb') then
    return null;
  end if;
  entete := brut::jsonb ->> 'x-apercu-role';
  if entete = 'stagiaire' then
    return entete;
  end if;
  if entete in ('formateur', 'direction', 'siege') and fondateur_reel() then
    return entete;
  end if;
  return null;
end;
$function$;

-- Le fondateur, hors aperçu : en aperçu, il n'a que les droits du rôle simulé.
create function public.est_fondateur()
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select apercu_role() is null and fondateur_reel();
$function$;

-- Formateur de la promo p : une affectation formateur sur p, ou le fondateur. En aperçu, seul l'aperçu formateur
-- l'est, et de la seule promo affichée.
create function public.est_formateur(p integer)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select case
           when apercu.role is not null then apercu.role = 'formateur' and coalesce(p = promo_courante(), false)
           else fondateur_reel()
             or exists (select 1 from affectations af
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and af.role = 'formateur' and af.promo_id = p)
         end
    from (select apercu_role() as role) apercu;
$function$;

-- Direction du lieu l : une affectation direction sur l, ou le fondateur. En aperçu, seul l'aperçu direction l'est,
-- et du seul lieu affiché (celui de la promo affichée).
create function public.est_direction(l integer)
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select case
           when apercu.role is not null then apercu.role = 'direction' and coalesce(l = lieu_courant(), false)
           else fondateur_reel()
             or exists (select 1 from affectations af
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and af.role = 'direction' and af.lieu_id = l)
         end
    from (select apercu_role() as role) apercu;
$function$;

-- Le siège : une affectation siège, ou le fondateur. En aperçu, seul l'aperçu siege l'est.
create function public.est_siege()
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select case
           when apercu.role is not null then apercu.role = 'siege'
           else fondateur_reel()
             or exists (select 1 from affectations af
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and af.role = 'siege')
         end
    from (select apercu_role() as role) apercu;
$function$;

-- Le lieu de la promo p.
create function public.lieu_de_promo(p integer)
returns integer language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select pr.lieu_id from promos pr where pr.id = p;
$function$;

-- Formateur de la promo affichée.
create function public.formateur_courant()
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select est_formateur(promo_courante());
$function$;

-- Direction du lieu de la promo affichée.
create function public.direction_courante()
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select est_direction(lieu_courant());
$function$;

-- L'équipe de la promo affichée : son formateur ou la direction de son lieu.
create function public.equipe_courante()
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select formateur_courant() or direction_courante();
$function$;

-- Qui rédige les contenus communs au réseau (cours, questions de QCM) : le formateur de la promo affichée, ou le siège.
create function public.redacteur_contenus()
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select formateur_courant() or est_siege();
$function$;

-- Les rôles réels de l'appelant sur la promo p, sans aperçu et sans le statut de fondateur : stagiaire (sa fiche est
-- dans p), formateur (affectation sur p), direction (affectation sur le lieu de p). Interne (mes_promos à l'étape 2) :
-- aucun droit d'exécution public.
create function public.roles_reels(p integer)
returns text[] language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select array_remove(array[
    case when exists (select 1 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
                       where lower(up.email) = lower((select auth.jwt() ->> 'email')) and s.promo_id = p)
         then 'stagiaire' end,
    case when exists (select 1 from affectations af
                       where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                         and af.role = 'formateur' and af.promo_id = p)
         then 'formateur' end,
    case when exists (select 1 from affectations af join promos pr on pr.lieu_id = af.lieu_id
                       where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                         and af.role = 'direction' and pr.id = p)
         then 'direction' end
  ], null);
$function$;

-- Droits d'exécution : les fonctions qu'une règle appelle directement sont ouvertes à anon et authenticated ;
-- fondateur_reel, apercu_role et roles_reels ne s'appellent que depuis les fonctions ci-dessus (security definer).
revoke all on function public.fondateur_reel(), public.apercu_role(), public.roles_reels(integer)
  from public, anon, authenticated;
revoke all on function public.est_fondateur(), public.est_formateur(integer), public.est_direction(integer),
  public.est_siege(), public.lieu_de_promo(integer), public.formateur_courant(), public.direction_courante(),
  public.equipe_courante(), public.redacteur_contenus() from public;
grant execute on function public.est_fondateur(), public.est_formateur(integer), public.est_direction(integer),
  public.est_siege(), public.lieu_de_promo(integer), public.formateur_courant(), public.direction_courante(),
  public.equipe_courante(), public.redacteur_contenus() to anon, authenticated;

-- 3. Droits et règles de la table ----------------------------------------------------------------------------------
-- Lecture, ajout et retrait pour authenticated ; rien pour anon ; aucune modification (on retire puis on ajoute).
-- L'identifiant vient de sa séquence sans droit sur elle (colonne d'identité) : la séquence reste fermée.
alter table public.affectations enable row level security;
revoke all on public.affectations from public, anon, authenticated;
grant select, insert, delete on public.affectations to authenticated;
revoke all on sequence public.affectations_id_seq from public, anon, authenticated;

-- Lecture : ses propres lignes ; tout pour le fondateur ; les formateurs d'une promo dont on est formateur ou
-- direction ; les directions de son lieu ; les directions et le siège pour le siège.
create policy affectations_lecture on public.affectations
  for select to authenticated
  using (
       lower(email) = lower((select auth.jwt() ->> 'email'))
    or (select public.est_fondateur())
    or (role = 'formateur'
        and (public.est_formateur(promo_id) or public.est_direction(public.lieu_de_promo(promo_id))))
    or (role = 'direction' and public.est_direction(lieu_id))
    or (role in ('direction', 'siege') and (select public.est_siege()))
  );

-- Ajout et retrait : un formateur par la direction du lieu de sa promo, une direction par le siège, le siège par le
-- fondateur.
create policy affectations_ajout on public.affectations
  for insert to authenticated
  with check (
       (role = 'formateur' and public.est_direction(public.lieu_de_promo(promo_id)))
    or (role = 'direction' and (select public.est_siege()))
    or (role = 'siege' and (select public.est_fondateur()))
  );

create policy affectations_retrait on public.affectations
  for delete to authenticated
  using (
       (role = 'formateur' and public.est_direction(public.lieu_de_promo(promo_id)))
    or (role = 'direction' and (select public.est_siege()))
    or (role = 'siege' and (select public.est_fondateur()))
  );

-- 4. L'amorce ------------------------------------------------------------------------------------------------------
insert into public.affectations (email, role, promo_id, cree_par)
select up.email, 'formateur', pr.id, 'migration 20261028_roles_1'
  from public.user_profiles up
 cross join public.promos pr
 where up.role = 'prof' and up.is_admin
 order by up.email, pr.id;
