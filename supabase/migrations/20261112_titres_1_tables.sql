-- Titres et droits à la carte, étape 1, migration 1 (invisible : aucun écran, aucune règle ne change) : la table des titres,
-- les trois titres fixes (un par niveau) et la colonne titre_id des affectations, remplie d'office.
--   _pages_du_niveau(niveau)   la seule table des pages d'un niveau et de leur plafond (2 : Voir et Modifier ; 1 : Voir seul).
--   _cases_valides(niveau, j)  vrai si un jsonb de cases est admissible : pages du niveau, valeurs non/voir/modifier, plafonds,
--                              « voir » interdit sur Réglages, et la règle des noms de stagiaires (spec § 5.4).
--   titres                     un titre = un nom, un niveau (promo, centre, reseau), un centre éventuel, des cases. Les titres
--                              fixes (Formateur, Direction de centre, Siège) n'ont pas de centre ; leurs cases restent vides
--                              (« toutes au maximum » se lit dans le niveau, pas dans le jsonb). Aucun droit pour anon ni
--                              authenticated : les fonctions de l'étape 2 en donneront la lecture.
--   affectations.titre_id      le titre porté par chaque ligne ; un client ne le choisit jamais (le droit d'insertion par
--                              colonne ne change pas), le déclencheur le pose d'après le rôle et refuse toute incohérence.
-- Le retour (20261112_titres_1_tables_retour.sql) remet la base dans l'état d'avant.
set local lock_timeout = '3s';

-- 1. Les pages de chaque niveau et leur plafond.
create or replace function public._pages_du_niveau(p_niveau text)
returns table(page text, plafond integer)
language sql
immutable
set search_path to 'public', 'pg_temp'
as $f$
  select v.page, v.plafond
    from (values
      ('promo', 'planning', 2), ('promo', 'emargement', 2), ('promo', 'stagiaires', 2), ('promo', 'notes', 2),
      ('promo', 'cours', 2), ('promo', 'ccp2', 1), ('promo', 'indicateurs', 1), ('promo', 'reglages', 2),
      ('centre', 'promos', 2), ('centre', 'stagiaires', 2), ('centre', 'emargement', 1), ('centre', 'notes', 1),
      ('centre', 'equipe', 2), ('centre', 'reglages', 2),
      ('reseau', 'cours', 2), ('reseau', 'directions', 2), ('reseau', 'reglages', 2)
    ) as v(niveau, page, plafond)
   where v.niveau = p_niveau;
$f$;

-- 2. Un jsonb de cases est-il admissible pour ce niveau ?
create or replace function public._cases_valides(p_niveau text, p_cases jsonb)
returns boolean
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $f$
declare
  v_cle text;
  v_val jsonb;
  v_plafond integer;
  v_pages text[] := array(select page from public._pages_du_niveau(p_niveau));
begin
  if p_cases is null or jsonb_typeof(p_cases) <> 'object' or cardinality(v_pages) = 0 then
    return false;
  end if;
  for v_cle, v_val in select * from jsonb_each(p_cases) loop
    if not (v_cle = any (v_pages)) then
      return false;
    end if;
    if jsonb_typeof(v_val) <> 'string' or (v_val #>> '{}') not in ('non', 'voir', 'modifier') then
      return false;
    end if;
    select p.plafond into v_plafond from public._pages_du_niveau(p_niveau) p where p.page = v_cle;
    if v_cle = 'reglages' and (v_val #>> '{}') = 'voir' then
      return false;
    end if;
    if v_plafond = 1 and (v_val #>> '{}') = 'modifier' then
      return false;
    end if;
  end loop;
  -- Les pages qui montrent des noms de stagiaires demandent Stagiaires au moins en lecture, au même niveau (spec § 5.4).
  if p_niveau = 'promo' and coalesce(p_cases ->> 'stagiaires', 'non') = 'non'
     and (coalesce(p_cases ->> 'planning', 'non') <> 'non' or coalesce(p_cases ->> 'emargement', 'non') <> 'non'
          or coalesce(p_cases ->> 'notes', 'non') <> 'non' or coalesce(p_cases ->> 'indicateurs', 'non') <> 'non') then
    return false;
  end if;
  if p_niveau = 'centre' and coalesce(p_cases ->> 'stagiaires', 'non') = 'non'
     and (coalesce(p_cases ->> 'emargement', 'non') <> 'non' or coalesce(p_cases ->> 'notes', 'non') <> 'non') then
    return false;
  end if;
  return true;
end $f$;

revoke all on function public._pages_du_niveau(text) from public, anon, authenticated, service_role;
revoke all on function public._cases_valides(text, jsonb) from public, anon, authenticated, service_role;

-- 3. La table des titres.
create table public.titres (
  id bigint generated always as identity primary key,
  nom text not null,
  niveau text not null check (niveau in ('promo', 'centre', 'reseau')),
  lieu_id integer references public.lieux (id) on delete cascade,
  fixe boolean not null default false,
  origine_id bigint references public.titres (id) on delete set null,
  cases jsonb not null default '{}'::jsonb,
  cree_le timestamptz default now(),
  cree_par text,
  modifie_le timestamptz,
  modifie_par text,
  constraint titres_fixe_sans_centre check (not fixe or lieu_id is null),
  constraint titres_reseau_sans_centre check (niveau <> 'reseau' or lieu_id is null),
  constraint titres_origine_dun_centre check (origine_id is null or lieu_id is not null),
  constraint titres_cases_valides check (public._cases_valides(niveau, cases))
);
create unique index titres_portee_nom on public.titres (lieu_id, lower(nom)) nulls not distinct;
create unique index titres_fixe_du_niveau on public.titres (niveau) where fixe;
alter table public.titres enable row level security;
revoke all on public.titres from public, anon, authenticated;
revoke all on sequence public.titres_id_seq from public, anon, authenticated;

-- 4. Les trois titres fixes.
insert into public.titres (nom, niveau, fixe, cases, cree_par) values
  ('Formateur', 'promo', true, '{}'::jsonb, 'migration 20261112_titres_1'),
  ('Direction de centre', 'centre', true, '{}'::jsonb, 'migration 20261112_titres_1'),
  ('Siège', 'reseau', true, '{}'::jsonb, 'migration 20261112_titres_1');

create or replace function public.titre_fixe(p_niveau text)
returns bigint
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $f$
  select t.id from public.titres t where t.fixe and t.niveau = p_niveau;
$f$;
revoke all on function public.titre_fixe(text) from public, anon, authenticated, service_role;

-- 5. La colonne des affectations : nullable d'abord, remplie, puis obligatoire.
alter table public.affectations add column titre_id bigint references public.titres (id) on delete restrict;
update public.affectations a
   set titre_id = public.titre_fixe(case a.role when 'formateur' then 'promo' when 'direction' then 'centre' else 'reseau' end);
alter table public.affectations alter column titre_id set not null;

-- 6. Le déclencheur : le titre d'une ligne est toujours cohérent avec son rôle, son centre et les autres lignes de la personne.
create or replace function public._affectations_titre()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $f$
declare
  v_niveau text := case new.role when 'formateur' then 'promo' when 'direction' then 'centre' when 'siege' then 'reseau' end;
  v_titre record;
  v_lieu integer;
begin
  if v_niveau is null then
    return new; -- un rôle inconnu est refusé par la contrainte de la table
  end if;
  if new.titre_id is null then
    new.titre_id := public.titre_fixe(v_niveau);
  end if;
  select t.niveau, t.lieu_id into v_titre from public.titres t where t.id = new.titre_id;
  if not found then
    return new; -- la clé étrangère refuse un titre qui n'existe pas
  end if;
  if v_titre.niveau <> v_niveau then
    raise exception 'titres: Ce titre ne correspond pas au niveau de cette affectation.' using errcode = '23514';
  end if;
  -- Le centre de la ligne : celui de la promo pour un formateur, le centre lui-même pour une direction.
  v_lieu := case new.role when 'formateur' then (select p.lieu_id from public.promos p where p.id = new.promo_id)
                          when 'direction' then new.lieu_id end;
  if v_titre.lieu_id is not null and v_titre.lieu_id is distinct from v_lieu then
    raise exception 'titres: Ce titre appartient à un autre centre.' using errcode = '23514';
  end if;
  -- Un titre de promo par personne et par centre (spec § 6.3).
  if new.role = 'formateur' and exists (
       select 1
         from public.affectations a
         join public.promos p on p.id = a.promo_id
        where lower(a.email) = lower(new.email) and a.role = 'formateur'
          and a.id is distinct from new.id
          and p.lieu_id is not distinct from v_lieu
          and a.titre_id <> new.titre_id) then
    raise exception 'titres: Cette personne a déjà un autre titre de promo dans ce centre.' using errcode = '23514';
  end if;
  return new;
end $f$;
revoke all on function public._affectations_titre() from public, anon, authenticated, service_role;

create trigger affectations_titre
  before insert or update of titre_id, role, promo_id, lieu_id on public.affectations
  for each row execute function public._affectations_titre();
