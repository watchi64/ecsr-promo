-- Cloisonnement par organisme, étape 1 : les fondations, invisibles pour l'app (spec
-- docs/superpowers/specs/2026-11-27-cloisonnement-organismes-design.md, § 5.1, § 5.2 et § 5.5 ; plan, tâche 2).
-- Aucune règle (RLS) ni fonction existante n'est touchée : les fonctions posées ici ne sont appelées par aucune règle ; seules les
-- quatre fonctions de l'app (mon_organisme, organismes_pour_support, ouvrir_acces_support, fermer_acces_support) sont ouvertes,
-- et l'app actuelle ne les appelle pas encore (étape 3).
-- Ce qu'elle pose :
--   * organismes (nom, rédacteur des contenus communs, habillage) ; le n° 1 est « ECF BOUSCAREN », rédacteur, avec l'habillage du
--     réseau d'aujourd'hui (settings.habillage_reseau ; « ecsr » quand il n'est pas réglé, ce que l'app montre alors). Sécurité de
--     ligne active, aucune règle, aucun droit pour anon ni authenticated : on la lit par mon_organisme() et organismes_pour_support().
--   * organisme_id sur lieux (obligatoire, unicité du nom par organisme, casse ignorée ; l'unicité globale de lieux.nom reste
--     jusqu'à l'étape 2b), affectations (rôle siège seulement), titres (titres réseau non fixes seulement), journal_droits,
--     profs, ressources (nul vaudra « carte commune » à l'étape 2c) et qcm_signalements : tout l'existant sur l'organisme 1.
--   * acces_fondateur, le journal du fondateur : une ligne de rattachement (sans fin ni motif) sur l'organisme 1 pour chaque compte
--     is_founder ; les accès support (motif d'au moins 10 caractères, 2 heures au plus) ne s'écrivent que par
--     ouvrir_acces_support() (déclencheur : toute autre insertion est refusée) ; aucune suppression, aucune modification sauf la fermeture anticipée d'un support (ferme_le avancé à
--     maintenant), même pour le propriétaire. Lecture : le fondateur, et le siège de l'organisme de la ligne. Un compte qui devient
--     fondateur après la migration reçoit aussitôt son rattachement (déclencheur sur user_profiles), sur l'organisme des
--     rattachements existants, sinon sur l'organisme unique.
--   * le vocabulaire : organisme_de_lieu, organisme_de_promo, organisme_actif_fondateur, fondateur_sur, organisme_courant,
--     est_siege_de, organisme_redacteur_courant, mon_organisme, organismes_pour_support, ouvrir_acces_support,
--     fermer_acces_support.
--   * le remplissage des insertions de l'ancienne app (iPhone en cache) : sur lieux, profs, ressources, qcm_signalements,
--     affectations (siège) et titres (réseau non fixe), un organisme_id absent prend l'organisme du titre (affectation siège),
--     sinon organisme_courant() ; sinon, tant qu'un seul organisme existe, celui-là, quel que soit l'appelant (propriétaire,
--     service_role, mais aussi un compte connecté sans promo ni affectation : l'étape reste invisible, aucune insertion qui
--     passait hier n'est refusée) ; sinon refus « Organisme introuvable pour cette ligne. » (22023). Sur journal_droits,
--     l'organisme se lit sur la ligne (centre, promo, titre, siège nommé), sinon organisme_courant(), sinon l'organisme unique ;
--     jamais de refus (le journal ne bloque aucun geste).
-- Garde : rien de ce qu'elle crée n'existe encore ; ce qu'elle modifie ou lit existe ; aucun doublon de nom de centre à la casse
-- près (l'index unique échouerait). Aucun corps de fonction existant n'est remplacé, donc aucun md5.
-- Preuve : tests/sql/cloisonnement-preuve.sql (node outils/assembler_repetition_roles.mjs cloisonnement --etapes 1 <sortie>).
-- Retour : 20261128_cloisonnement_1_fondations_retour.sql.
-- À appliquer en une seule transaction : psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261128_cloisonnement_1_fondations.sql.

set local lock_timeout = '3s';

do $garde$
declare
  v_liste text;
begin
  if to_regclass('public.organismes') is not null or to_regclass('public.acces_fondateur') is not null then
    raise exception 'cloisonnement_1 : la table organismes ou acces_fondateur existe déjà ; rien n''est changé';
  end if;
  select string_agg(t, ', ') into v_liste
    from unnest(array['lieux', 'affectations', 'titres', 'journal_droits', 'profs', 'ressources', 'qcm_signalements', 'settings',
                      'user_profiles', 'promos']) t
   where to_regclass('public.' || t) is null;
  if v_liste is not null then
    raise exception 'cloisonnement_1 : table(s) absente(s) : % ; rien n''est changé', v_liste;
  end if;
  select string_agg(c.relname, ', ') into v_liste
    from pg_attribute a join pg_class c on c.oid = a.attrelid
   where c.relnamespace = 'public'::regnamespace and a.attname = 'organisme_id' and not a.attisdropped
     and c.relname in ('lieux', 'affectations', 'titres', 'journal_droits', 'profs', 'ressources', 'qcm_signalements');
  if v_liste is not null then
    raise exception 'cloisonnement_1 : colonne organisme_id déjà présente sur : % ; rien n''est changé', v_liste;
  end if;
  select string_agg(p.proname, ', ') into v_liste
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('organisme_de_lieu', 'organisme_de_promo', 'organisme_actif_fondateur', 'fondateur_sur', 'organisme_courant',
                       'est_siege_de', 'organisme_redacteur_courant', 'mon_organisme', 'organismes_pour_support', 'ouvrir_acces_support',
                       'fermer_acces_support', '_organisme_par_defaut', '_journal_droits_organisme', '_acces_fondateur_journal',
                       '_rattachement_fondateur');
  if v_liste is not null then
    raise exception 'cloisonnement_1 : fonction(s) déjà présente(s) : % ; rien n''est changé', v_liste;
  end if;
  if to_regclass('public.lieux_organisme_nom') is not null then
    raise exception 'cloisonnement_1 : l''index lieux_organisme_nom existe déjà ; rien n''est changé';
  end if;
  select string_agg(x.t || '.' || x.c, ', ') into v_liste
    from (values ('user_profiles', 'email'), ('user_profiles', 'is_founder'), ('affectations', 'email'), ('affectations', 'role'),
                 ('affectations', 'titre_id'), ('affectations', 'lieu_id'), ('affectations', 'promo_id'), ('titres', 'niveau'),
                 ('titres', 'fixe'), ('journal_droits', 'lieu_id'), ('journal_droits', 'promo_id'), ('journal_droits', 'titre_id'),
                 ('journal_droits', 'pour'), ('settings', 'key'), ('settings', 'value'), ('settings', 'promo_id'),
                 ('promos', 'lieu_id'), ('lieux', 'nom')) x(t, c)
   where not exists (select 1 from pg_attribute a where a.attrelid = to_regclass('public.' || x.t) and a.attname = x.c and not a.attisdropped);
  if v_liste is not null then
    raise exception 'cloisonnement_1 : colonne(s) absente(s) : % ; rien n''est changé', v_liste;
  end if;
  select string_agg(f, ', ') into v_liste
    from unnest(array['public.fondateur_reel()', 'public.apercu_role()', 'public.promo_courante()', 'public.est_fondateur()']) f
   where to_regprocedure(f) is null;
  if v_liste is not null then
    raise exception 'cloisonnement_1 : fonction(s) absente(s) : % ; rien n''est changé', v_liste;
  end if;
  if exists (select 1 from public.lieux l group by lower(l.nom) having count(*) > 1) then
    raise exception 'cloisonnement_1 : deux centres portent le même nom à la casse près ; rien n''est changé';
  end if;
end $garde$;

-- 1. Les organismes ; le n° 1 reprend ECF.
create table public.organismes (
  id integer generated always as identity primary key,
  nom text not null unique,
  redacteur boolean not null default false,
  habillage text not null check (habillage in ('ecsr', 'ecf')),
  cree_le timestamptz not null default now()
);
alter table public.organismes enable row level security;
-- service_role compris : sur Supabase, les droits par défaut du propriétaire du schéma donnent tout sur une table neuve à anon,
-- authenticated et service_role.
revoke all on public.organismes from public, anon, authenticated, service_role;
revoke all on sequence public.organismes_id_seq from public, anon, authenticated, service_role;

insert into public.organismes (nom, redacteur, habillage)
select 'ECF BOUSCAREN', true,
       coalesce((select s.value from public.settings s
                  where s.promo_id is null and s.key = 'habillage_reseau' and s.value in ('ecsr', 'ecf')), 'ecsr');

do $un$
begin
  if (select o.id from public.organismes o where o.nom = 'ECF BOUSCAREN') is distinct from 1 then
    raise exception 'cloisonnement_1 : ECF BOUSCAREN n''a pas reçu le numéro 1 ; rien n''est changé';
  end if;
end $un$;

-- 2. Les colonnes, remplies avant que les déclencheurs n'existent.
alter table public.lieux add column organisme_id integer references public.organismes;
update public.lieux set organisme_id = 1;
alter table public.lieux alter column organisme_id set not null;
create unique index lieux_organisme_nom on public.lieux (organisme_id, lower(nom));

alter table public.affectations add column organisme_id integer references public.organismes;
update public.affectations set organisme_id = 1 where role = 'siege';

alter table public.titres add column organisme_id integer references public.organismes;
update public.titres set organisme_id = 1 where niveau = 'reseau' and not fixe;

alter table public.profs add column organisme_id integer references public.organismes;
update public.profs set organisme_id = 1;

alter table public.ressources add column organisme_id integer references public.organismes;
update public.ressources set organisme_id = 1;

alter table public.qcm_signalements add column organisme_id integer references public.organismes;
update public.qcm_signalements set organisme_id = 1;

-- Le journal garde ses lignes même si l'organisme disparaît : pas de clé étrangère.
alter table public.journal_droits add column organisme_id integer;
update public.journal_droits j
   set organisme_id = coalesce((select l.organisme_id from public.lieux l where l.id = j.lieu_id),
                               (select l.organisme_id from public.promos p join public.lieux l on l.id = p.lieu_id where p.id = j.promo_id),
                               (select t.organisme_id from public.titres t where t.id = j.titre_id),
                               1);

-- 3. Le journal du fondateur : un rattachement (sans fin ni motif) par compte fondateur, sur l'organisme 1.
create table public.acces_fondateur (
  id bigint generated always as identity primary key,
  email text not null check (email = lower(email)),
  organisme_id integer not null references public.organismes,
  ouvert_le timestamptz not null default now(),
  ferme_le timestamptz,
  motif text,
  ouvert_par text not null default lower(auth.jwt() ->> 'email'),
  constraint acces_fondateur_forme check ((ferme_le is null) = (motif is null)),
  constraint acces_fondateur_motif check (motif is null or char_length(regexp_replace(motif, '^\s+|\s+$', '', 'g')) >= 10),
  constraint acces_fondateur_duree check (ferme_le is null or (ferme_le >= ouvert_le and ferme_le <= ouvert_le + interval '2 hours'))
);
create unique index acces_fondateur_un_rattachement on public.acces_fondateur (email) where ferme_le is null;
alter table public.acces_fondateur enable row level security;
revoke all on public.acces_fondateur from public, anon, authenticated, service_role;
revoke all on sequence public.acces_fondateur_id_seq from public, anon, authenticated, service_role;

insert into public.acces_fondateur (email, organisme_id, ouvert_par)
select distinct lower(up.email), 1, 'système' from public.user_profiles up where up.is_founder;

-- 4. Le vocabulaire.
create function public.organisme_de_lieu(p_lieu integer)
 returns integer
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select l.organisme_id from lieux l where l.id = p_lieu;
$function$;

create function public.organisme_de_promo(p_promo integer)
 returns integer
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select l.organisme_id from promos pr join lieux l on l.id = pr.lieu_id where pr.id = p_promo;
$function$;

-- Le support ouvert le plus récent, non fermé et non échu, sinon le rattachement, sinon nul (et nul pour qui n'est pas fondateur).
create function public.organisme_actif_fondateur()
 returns integer
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select case when fondateur_reel() then coalesce(
    (select af.organisme_id from acces_fondateur af
      where af.email = lower((select auth.jwt() ->> 'email')) and af.motif is not null
        and af.ouvert_le <= now() and af.ferme_le > now()
      order by af.ouvert_le desc, af.id desc limit 1),
    (select af.organisme_id from acces_fondateur af
      where af.email = lower((select auth.jwt() ->> 'email')) and af.ferme_le is null
      order by af.id limit 1))
  end;
$function$;

create function public.fondateur_sur(p_organisme integer)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(p_organisme is not null and fondateur_reel() and p_organisme = organisme_actif_fondateur(), false);
$function$;

-- L'organisme de la promo affichée ; sans promo, celui de l'affectation siège, puis celui des autres affectations s'il est unique
-- (direction d'un centre sans promo), puis celui de la promo de la fiche stagiaire (en-tête d'une promo qui n'est plus la sienne).
-- Le fondateur : son organisme actif ; en aperçu formateur, direction ou stagiaire, celui de la promo affichée. Un fondateur sans
-- rattachement suit la règle commune.
create function public.organisme_courant()
 returns integer
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  v_apercu text;
  v_promo integer;
  v_o integer;
  v_n integer;
begin
  if v_moi is null then
    return null;
  end if;
  if fondateur_reel() then
    v_apercu := apercu_role();
    if v_apercu is not null and v_apercu <> 'siege' then
      v_promo := promo_courante();
      if v_promo is not null then
        return organisme_de_promo(v_promo);
      end if;
    end if;
    v_o := organisme_actif_fondateur();
    if v_o is not null then
      return v_o;
    end if;
  end if;
  v_promo := promo_courante();
  if v_promo is not null then
    return organisme_de_promo(v_promo);
  end if;
  select af.organisme_id into v_o from affectations af
   where lower(af.email) = v_moi and af.role = 'siege' and af.organisme_id is not null
   order by af.id limit 1;
  if v_o is not null then
    return v_o;
  end if;
  select min(x.o), count(distinct x.o) into v_o, v_n
    from (select case af.role when 'direction' then organisme_de_lieu(af.lieu_id) else organisme_de_promo(af.promo_id) end as o
            from affectations af
           where lower(af.email) = v_moi and af.role in ('direction', 'formateur')) x
   where x.o is not null;
  if v_n = 1 then
    return v_o;
  end if;
  select organisme_de_promo(s.promo_id) into v_o
    from user_profiles up join stagiaires s on s.id = up.stagiaire_id
   where lower(up.email) = v_moi
   order by up.email limit 1;
  return v_o;
end;
$function$;

-- Siège de cet organisme : une affectation siège sur lui, ou le fondateur dont c'est l'organisme actif ; en aperçu, l'aperçu siège
-- du fondateur sur son organisme actif.
create function public.est_siege_de(p_organisme integer)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(p_organisme is not null and case
           when apercu.role is not null then apercu.role = 'siege' and fondateur_sur(p_organisme)
           else fondateur_sur(p_organisme)
             or exists (select 1 from affectations af
                         where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                           and af.role = 'siege' and af.organisme_id = p_organisme)
         end, false)
    from (select apercu_role() as role) apercu;
$function$;

create function public.organisme_redacteur_courant()
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((select o.redacteur from organismes o where o.id = organisme_courant()), false);
$function$;

-- L'organisme de l'appelant pour l'app (nom imprimé, rédacteur, habillage) ; support_jusqua : l'échéance de l'accès support du
-- fondateur quand c'est l'organisme affiché, nul sinon.
create function public.mon_organisme()
 returns table(id integer, nom text, redacteur boolean, habillage text, support_jusqua timestamptz)
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  v_o integer;
begin
  if v_moi is null then
    raise exception 'organisme: Connexion requise.' using errcode = '42501';
  end if;
  v_o := organisme_courant();
  return query
    select o.id, o.nom, o.redacteur, o.habillage,
           (select max(af.ferme_le) from acces_fondateur af
             where fondateur_reel() and af.email = v_moi and af.organisme_id = o.id
               and af.motif is not null and af.ouvert_le <= now() and af.ferme_le > now())
      from organismes o
     where o.id = v_o;
end;
$function$;

create function public.organismes_pour_support()
 returns table(id integer, nom text)
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
#variable_conflict use_column
begin
  if auth.jwt() ->> 'email' is null or not fondateur_reel() then
    raise exception 'support: Réservé au fondateur.' using errcode = '42501';
  end if;
  return query select o.id, o.nom from organismes o order by o.id;
end;
$function$;

-- Ouvre un accès support : fondateur seulement, motif d'au moins 10 caractères (blancs autour retirés), durée de plus de 0 et de
-- 2 heures au plus, un autre organisme que celui du rattachement. Ferme d'abord tout support encore ouvert, sous un verrou propre au
-- fondateur (deux appels simultanés ne laissent jamais deux supports ouverts). Les blancs retirés du motif comprennent tabulations
-- et retours à la ligne.
create function public.ouvrir_acces_support(p_organisme integer, p_motif text, p_duree interval default '2 hours')
 returns public.acces_fondateur
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  v_motif text := regexp_replace(p_motif, '^\s+|\s+$', '', 'g');
  v_ligne acces_fondateur;
begin
  if v_moi is null or not fondateur_reel() then
    raise exception 'support: Réservé au fondateur.' using errcode = '42501';
  end if;
  if v_motif is null or char_length(v_motif) < 10 then
    raise exception 'support: Le motif doit compter au moins 10 caractères.' using errcode = '22023';
  end if;
  if p_duree is null or p_duree <= interval '0' or p_duree > interval '2 hours' then
    raise exception 'support: La durée doit être positive et ne pas dépasser 2 heures.' using errcode = '22023';
  end if;
  if p_organisme is null or not exists (select 1 from organismes o where o.id = p_organisme) then
    raise exception 'support: Cet organisme n''existe pas.' using errcode = '22023';
  end if;
  if exists (select 1 from acces_fondateur af where af.email = v_moi and af.ferme_le is null and af.organisme_id = p_organisme) then
    raise exception 'support: Vous êtes déjà rattaché à cet organisme.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('acces_fondateur:' || v_moi));
  update acces_fondateur af set ferme_le = now()
   where af.email = v_moi and af.motif is not null and af.ferme_le > now();
  -- Le déclencheur du journal n'accepte une insertion que sous ce marqueur, posé le temps de l'insertion.
  perform set_config('cloisonnement.journal_fondateur', 'oui', true);
  insert into acces_fondateur (email, organisme_id, ouvert_le, ferme_le, motif, ouvert_par)
  values (v_moi, p_organisme, now(), now() + p_duree, v_motif, v_moi)
  returning * into v_ligne;
  perform set_config('cloisonnement.journal_fondateur', '', true);
  return v_ligne;
end;
$function$;

create function public.fermer_acces_support()
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_moi text := lower(auth.jwt() ->> 'email');
begin
  if v_moi is null or not fondateur_reel() then
    raise exception 'support: Réservé au fondateur.' using errcode = '42501';
  end if;
  update acces_fondateur af set ferme_le = now()
   where af.email = v_moi and af.motif is not null and af.ferme_le > now();
end;
$function$;

-- 5. Les déclencheurs.
create function public._organisme_par_defaut()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_o integer;
  v_n integer;
begin
  if new.organisme_id is not null then
    return new;
  end if;
  if tg_table_name = 'affectations' then
    if new.role is distinct from 'siege' then
      return new;
    end if;
    -- Un titre réseau d'un organisme fait siège de cet organisme.
    select t.organisme_id into v_o from titres t where t.id = new.titre_id;
  elsif tg_table_name = 'titres' then
    if new.niveau is distinct from 'reseau' or new.fixe then
      return new;
    end if;
  end if;
  v_o := coalesce(v_o, organisme_courant());
  if v_o is null then
    -- Un seul organisme en base : celui-là, quel que soit l'appelant (rien de ce qui passait avant l'étape 1 n'est refusé).
    select min(o.id), count(*) into v_o, v_n from organismes o;
    if v_n <> 1 then
      v_o := null;
    end if;
  end if;
  if v_o is null then
    raise exception 'Organisme introuvable pour cette ligne.' using errcode = '22023';
  end if;
  new.organisme_id := v_o;
  return new;
end;
$function$;

create function public._journal_droits_organisme()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_o integer;
  v_n integer;
begin
  v_o := coalesce(organisme_de_lieu(new.lieu_id), organisme_de_promo(new.promo_id),
                  (select t.organisme_id from titres t where t.id = new.titre_id),
                  (select af.organisme_id from affectations af
                    where new.pour is not null and lower(af.email) = lower(new.pour) and af.role = 'siege' and af.organisme_id is not null
                    order by af.id limit 1),
                  organisme_courant());
  if v_o is null then
    select min(o.id), count(*) into v_o, v_n from organismes o;
    if v_n <> 1 then
      v_o := null;
    end if;
  end if;
  new.organisme_id := v_o;
  return new;
end;
$function$;

create function public._acces_fondateur_journal()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'support: Le journal du fondateur ne s''efface pas.' using errcode = '42501';
  end if;
  -- Insertion : seulement depuis ouvrir_acces_support() ou _rattachement_fondateur(), qui posent le marqueur le temps de leur
  -- insertion. Aucun rôle de l'API n'a le droit d'insertion ; le marqueur arrête aussi une insertion directe que permettrait un
  -- droit accordé un jour par erreur (PostgREST n'expose pas set_config).
  if tg_op = 'INSERT' then
    if coalesce(current_setting('cloisonnement.journal_fondateur', true), '') <> 'oui' then
      raise exception 'support: Le journal du fondateur ne s''écrit que par ouvrir_acces_support().' using errcode = '42501';
    end if;
    return new;
  end if;
  if old.motif is not null and old.ferme_le is not null and old.ferme_le > now() and new.ferme_le = now()
     and (new.id, new.email, new.organisme_id, new.ouvert_le, new.motif, new.ouvert_par)
         is not distinct from (old.id, old.email, old.organisme_id, old.ouvert_le, old.motif, old.ouvert_par) then
    return new;
  end if;
  raise exception 'support: Le journal du fondateur ne se modifie pas (seule la fermeture anticipée d''un accès support est permise).'
    using errcode = '42501';
end;
$function$;

-- Un compte qui devient fondateur reçoit son rattachement : l'organisme des rattachements existants (le plus ancien), sinon
-- l'organisme unique ; sinon rien (à poser à la main). Un rattachement existant n'est jamais doublé.
create function public._rattachement_fondateur()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_o integer;
  v_n integer;
begin
  if exists (select 1 from acces_fondateur af where af.email = lower(new.email) and af.ferme_le is null) then
    return null;
  end if;
  select af.organisme_id into v_o from acces_fondateur af where af.ferme_le is null order by af.id limit 1;
  if v_o is null then
    select min(o.id), count(*) into v_o, v_n from organismes o;
    if v_n <> 1 then
      return null;
    end if;
  end if;
  perform set_config('cloisonnement.journal_fondateur', 'oui', true);
  insert into acces_fondateur (email, organisme_id, ouvert_par)
  values (lower(new.email), v_o, coalesce(nullif(lower(auth.jwt() ->> 'email'), ''), 'système'));
  perform set_config('cloisonnement.journal_fondateur', '', true);
  return null;
end;
$function$;

create trigger rattachement_fondateur after insert or update of is_founder on public.user_profiles
  for each row when (new.is_founder) execute function public._rattachement_fondateur();
create trigger organisme_par_defaut before insert or update on public.lieux
  for each row when (new.organisme_id is null) execute function public._organisme_par_defaut();
create trigger organisme_par_defaut before insert or update on public.profs
  for each row when (new.organisme_id is null) execute function public._organisme_par_defaut();
create trigger organisme_par_defaut before insert or update on public.ressources
  for each row when (new.organisme_id is null) execute function public._organisme_par_defaut();
create trigger organisme_par_defaut before insert or update on public.qcm_signalements
  for each row when (new.organisme_id is null) execute function public._organisme_par_defaut();
create trigger organisme_par_defaut before insert or update on public.affectations
  for each row when (new.organisme_id is null and new.role = 'siege') execute function public._organisme_par_defaut();
create trigger organisme_par_defaut before insert or update on public.titres
  for each row when (new.organisme_id is null and new.niveau = 'reseau' and not new.fixe) execute function public._organisme_par_defaut();
create trigger journal_droits_organisme before insert on public.journal_droits
  for each row when (new.organisme_id is null) execute function public._journal_droits_organisme();
create trigger acces_fondateur_journal before insert or update or delete on public.acces_fondateur
  for each row execute function public._acces_fondateur_journal();
create trigger acces_fondateur_journal_vidage before truncate on public.acces_fondateur
  for each statement execute function public._acces_fondateur_journal();

-- 6. Lecture du journal du fondateur : lui, et le siège de l'organisme de la ligne. Aucune écriture directe.
grant select on public.acces_fondateur to authenticated;
create policy acces_fondateur_lecture on public.acces_fondateur for select to authenticated
  using ((select est_fondateur()) or est_siege_de(organisme_id));

-- 7. Les droits d'exécution : l'app appelle les quatre fonctions du support et de l'organisme ; est_siege_de sert la règle de lecture
--    ci-dessus ; le reste est interne.
revoke all on function public.organisme_de_lieu(integer) from public, anon, authenticated, service_role;
revoke all on function public.organisme_de_promo(integer) from public, anon, authenticated, service_role;
revoke all on function public.organisme_actif_fondateur() from public, anon, authenticated, service_role;
revoke all on function public.fondateur_sur(integer) from public, anon, authenticated, service_role;
revoke all on function public.organisme_courant() from public, anon, authenticated, service_role;
revoke all on function public.organisme_redacteur_courant() from public, anon, authenticated, service_role;
revoke all on function public._organisme_par_defaut() from public, anon, authenticated, service_role;
revoke all on function public._journal_droits_organisme() from public, anon, authenticated, service_role;
revoke all on function public._acces_fondateur_journal() from public, anon, authenticated, service_role;
revoke all on function public._rattachement_fondateur() from public, anon, authenticated, service_role;
revoke all on function public.est_siege_de(integer) from public, anon, authenticated, service_role;
grant execute on function public.est_siege_de(integer) to authenticated;
revoke all on function public.mon_organisme() from public, anon, authenticated, service_role;
grant execute on function public.mon_organisme() to authenticated;
revoke all on function public.organismes_pour_support() from public, anon, authenticated, service_role;
grant execute on function public.organismes_pour_support() to authenticated;
revoke all on function public.ouvrir_acces_support(integer, text, interval) from public, anon, authenticated, service_role;
grant execute on function public.ouvrir_acces_support(integer, text, interval) to authenticated;
revoke all on function public.fermer_acces_support() from public, anon, authenticated, service_role;
grant execute on function public.fermer_acces_support() to authenticated;
