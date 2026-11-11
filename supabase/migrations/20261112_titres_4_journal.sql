-- Titres et droits à la carte, étape 1, migration 4 (invisible : aucun écran) : le journal des droits du personnel (spec § 9).
--   journal_droits              une ligne par titre donné, retiré ou changé à une personne, et par titre créé, ajusté ou supprimé :
--                               quand, par qui, pour qui, sur quelle portée, l'avant et l'après. Aucune clé étrangère : la trace
--                               survit au titre, à la promo et au centre. Sécurité par ligne active, aucune règle, aucun droit
--                               pour anon ni authenticated (la lecture passera par des fonctions de l'étape 2).
--   _journal_affectations()     déclencheur des affectations : insertion (donne), suppression (retire), changement de titre (change).
--   _journal_titres()           déclencheur des titres : création (cree), ajustement du nom, des cases ou de la portée (ajuste),
--                               suppression (supprime).
--   effacer_adresse_journal(e)  fondateur hors aperçu seul : remplace l'adresse par « compte effacé » dans par et pour.
-- Aucune adresse dans avant ni apres (titre, nom, cases, portée seulement). « par » est l'adresse du jeton en minuscules, sinon
-- « système » (migration, cascade). Chaque écriture purge d'abord les lignes de plus de 3 ans (aucune tâche planifiée).
-- Les déclencheurs sont posés après le remplissage de la migration 1 : rien n'est journalisé pour les lignes existantes, et
-- les invitations de stagiaires (qui n'écrivent aucune affectation) n'y figurent pas.
-- Le retour (20261112_titres_4_journal_retour.sql) remet la base dans l'état d'avant.
set local lock_timeout = '3s';

-- 1. La table.
create table public.journal_droits (
  id bigint generated always as identity primary key,
  quand timestamptz not null default now(),
  par text not null,
  action text not null check (action in ('donne', 'retire', 'change', 'cree', 'ajuste', 'supprime')),
  pour text,
  titre_id bigint,
  titre_nom text not null,
  niveau text not null,
  lieu_id integer,
  promo_id integer,
  avant jsonb,
  apres jsonb
);
create index journal_droits_quand on public.journal_droits (quand);
create index journal_droits_lieu_quand on public.journal_droits (lieu_id, quand);
alter table public.journal_droits enable row level security;
revoke all on public.journal_droits from public, anon, authenticated;
revoke all on sequence public.journal_droits_id_seq from public, anon, authenticated;

-- 2. Le déclencheur des affectations.
create or replace function public._journal_affectations()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $f$
declare
  v_ligne public.affectations;
  v_lieu integer;
  v_t public.titres;
  v_av jsonb;
  v_ap jsonb;
  v_action text;
begin
  -- Conservation de 3 ans : purge à l'écriture.
  delete from public.journal_droits where quand < now() - interval '3 years';
  if tg_op = 'DELETE' then
    v_ligne := old;
  else
    v_ligne := new;
  end if;
  v_lieu := case v_ligne.role when 'formateur' then public.lieu_de_promo(v_ligne.promo_id)
                              when 'direction' then v_ligne.lieu_id end;
  select * into v_t from public.titres t where t.id = v_ligne.titre_id;
  if tg_op = 'INSERT' then
    v_action := 'donne';
    v_ap := jsonb_build_object('titre_id', v_t.id, 'nom', v_t.nom, 'cases', v_t.cases, 'niveau', v_t.niveau, 'lieu_id', v_lieu, 'promo_id', v_ligne.promo_id);
  elsif tg_op = 'DELETE' then
    v_action := 'retire';
    v_av := jsonb_build_object('titre_id', v_t.id, 'nom', v_t.nom, 'cases', v_t.cases, 'niveau', v_t.niveau, 'lieu_id', v_lieu, 'promo_id', v_ligne.promo_id);
  else
    v_action := 'change';
    v_ap := jsonb_build_object('titre_id', v_t.id, 'nom', v_t.nom, 'cases', v_t.cases, 'niveau', v_t.niveau, 'lieu_id', v_lieu, 'promo_id', v_ligne.promo_id);
    select jsonb_build_object('titre_id', t.id, 'nom', t.nom, 'cases', t.cases, 'niveau', t.niveau, 'lieu_id', v_lieu, 'promo_id', v_ligne.promo_id)
      into v_av from public.titres t where t.id = old.titre_id;
  end if;
  insert into public.journal_droits (par, action, pour, titre_id, titre_nom, niveau, lieu_id, promo_id, avant, apres)
  values (coalesce(nullif(lower((select auth.jwt() ->> 'email')), ''), 'système'), v_action, lower(v_ligne.email), v_ligne.titre_id,
          coalesce(v_t.nom, 'titre inconnu'),
          coalesce(v_t.niveau, case v_ligne.role when 'formateur' then 'promo' when 'direction' then 'centre' else 'reseau' end),
          v_lieu, v_ligne.promo_id, v_av, v_ap);
  return null;
end $f$;
revoke all on function public._journal_affectations() from public, anon, authenticated, service_role;

create trigger journal_affectations_ecriture
  after insert or delete on public.affectations
  for each row execute function public._journal_affectations();
create trigger journal_affectations_titre
  after update of titre_id on public.affectations
  for each row when (old.titre_id is distinct from new.titre_id)
  execute function public._journal_affectations();

-- 3. Le déclencheur des titres.
create or replace function public._journal_titres()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $f$
declare
  v_av jsonb;
  v_ap jsonb;
  v_action text;
  v_t public.titres;
begin
  delete from public.journal_droits where quand < now() - interval '3 years';
  if tg_op = 'DELETE' then
    v_t := old;
    v_action := 'supprime';
    v_av := jsonb_build_object('titre_id', old.id, 'nom', old.nom, 'cases', old.cases, 'niveau', old.niveau, 'lieu_id', old.lieu_id);
  elsif tg_op = 'INSERT' then
    v_t := new;
    v_action := 'cree';
    v_ap := jsonb_build_object('titre_id', new.id, 'nom', new.nom, 'cases', new.cases, 'niveau', new.niveau, 'lieu_id', new.lieu_id);
  else
    v_t := new;
    v_action := 'ajuste';
    v_av := jsonb_build_object('titre_id', old.id, 'nom', old.nom, 'cases', old.cases, 'niveau', old.niveau, 'lieu_id', old.lieu_id);
    v_ap := jsonb_build_object('titre_id', new.id, 'nom', new.nom, 'cases', new.cases, 'niveau', new.niveau, 'lieu_id', new.lieu_id);
  end if;
  insert into public.journal_droits (par, action, pour, titre_id, titre_nom, niveau, lieu_id, promo_id, avant, apres)
  values (coalesce(nullif(lower((select auth.jwt() ->> 'email')), ''), 'système'), v_action, null, v_t.id, v_t.nom, v_t.niveau,
          v_t.lieu_id, null, v_av, v_ap);
  return null;
end $f$;
revoke all on function public._journal_titres() from public, anon, authenticated, service_role;

create trigger journal_titres_ecriture
  after insert or delete on public.titres
  for each row execute function public._journal_titres();
create trigger journal_titres_ajuste
  after update on public.titres
  for each row when ((old.nom, old.cases, old.niveau, old.lieu_id) is distinct from (new.nom, new.cases, new.niveau, new.lieu_id))
  execute function public._journal_titres();

-- 4. L'effacement d'une adresse : le fondateur hors aperçu seul ; la trace du geste reste, l'adresse disparaît.
create or replace function public.effacer_adresse_journal(p_email text)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $f$
declare
  v_adresse text := lower(trim(coalesce(p_email, '')));
  v_n integer;
begin
  if not public.est_fondateur() then
    raise exception 'journal: Réservé au fondateur.' using errcode = '42501';
  end if;
  if v_adresse = '' then
    return 0;
  end if;
  update public.journal_droits j
     set par = case when lower(j.par) = v_adresse then 'compte effacé' else j.par end,
         pour = case when lower(j.pour) = v_adresse then 'compte effacé' else j.pour end
   where lower(j.par) = v_adresse or lower(j.pour) = v_adresse;
  get diagnostics v_n = row_count;
  return v_n;
end $f$;
revoke all on function public.effacer_adresse_journal(text) from public, anon, authenticated, service_role;
grant execute on function public.effacer_adresse_journal(text) to authenticated;
