-- Schéma minimal pour jouer la preuve de la conservation (tests/sql/conservation-preuve.sql) sur une base Postgres LOCALE
-- jetable (jamais en prod). Il reprend de la prod ce dont 20261110_conservation.sql dépend, dans l'état où la prod est le
-- 10/11/2026 (lot 4, émargement, questionnaires Q3 et registre Q4 appliqués), sur le modèle de
-- tests/sql/questionnaires-schema-minimal.sql (droits par défaut de Supabase compris) :
--   1. Rôles Supabase, auth.users, auth.jwt() / auth.uid(), droits par défaut accordés aux rôles de l'API.
--   2. Les tables que touchent _anonymiser_stagiaire et l'émargement, avec leurs SEULES colonnes et contraintes utiles,
--      relevées en lecture seule sur la base réelle le 10/11 (schema-reel-colonnes.txt, schema-reel-contraintes.txt du
--      dossier de la tâche) : lieux, promos, stagiaires (dont stagiaires_date_naissance_videe et
--      stagiaires_promo_prenom_unique), user_profiles, profs, settings, planning_entries, stagiaires_prive, dp_dossiers,
--      epcf_livrets, fiches_suivi, epcf_evaluations, evaluations, evaluations_audit, passages, passages_audit,
--      agenda_events, qcm_signalements, themes, themes_progression, conditions_acceptations, planning_jours_off. Les
--      valeurs par défaut en promo_courante() et les clés vers des tables absentes d'ici (competences, qcm_*) sont omises.
--   3. Fonctions d'avant le lot 4 dont l'étape 1 du lot 4 a besoin (copiées de questionnaires-schema-minimal.sql), puis
--      l'étape 1 du lot 4 rejouée telle quelle (supabase/migrations/20261028_roles_1_fondations.sql).
--   4. Étape 2 du lot 4, fonctions EXTRAITES du fichier du dépôt et jouées telles quelles : peut_acceder_promo,
--      promo_par_defaut, promo_courante, my_stagiaire_id, is_admin, is_prof, is_founder.
--   5. 20261023_emargement.sql rejouée telle quelle (elle demande profs, settings, planning_entries, is_admin(), is_prof(),
--      my_stagiaire_id()), puis les versions du lot 4 de emargement_feuille, emargement_ouvrir et emargement_signer
--      extraites (create or replace : droits du 23/10 gardés, comme en prod).
--   6. 20261005_effacement_donnees.sql, lignes de la table effacements_journal (sa contrainte de type et ses droits,
--      extraites), et la règle de lecture du journal de 20261028_roles_3_regles.sql (extraite) ; les quatre fonctions
--      d'effacement dans leur version du lot 4 (_anonymiser_stagiaire, anonymiser_promo, anonymiser_stagiaire,
--      etat_anonymisation_promo), extraites, avec les droits que leur a donnés la migration du 05/10 (même suite de
--      revoke et grant, sur les droits par défaut).
--   7. 20261108_questionnaires.sql rejouée telle quelle (peut_gerer_qualite, _questionnaire_jour, questions, réponses,
--      participations, ouvertures : tout ce que la partie questionnaires de la migration, tâche 3, réécrit ou complète).
--      tests/sql/questionnaires-preuve.sql se joue aussi sur ce schéma, avec ou sans la migration de la conservation.
--   8. 20261028_signalements_app.sql puis 20261109_registre_qualite.sql rejouées telles quelles (tableau et fonction du
--      registre qualité, que le lot Q5 réécrit : tache 4).
--   9. Suite du lot 5, étape 4 (20261111_espaces_4_donnees.sql, appliquée le 11/11) : ses sections 3 et 4 EXTRAITES et jouées
--      telles quelles, droits compris (etat_anonymisation_promo(p_promo) et anonymiser_promo(p_promo), que le lot Q5 retire et
--      que son retour recrée ; benevoles_a_purger(p_lieu) et purger_benevoles(p_ids, p_lieu), qu'il ne touche pas). Ses
--      sections 1 et 2 (ancien stagiaire invité au personnel) réécrivent inviter_compte et regler_affectations_formateur,
--      absentes d'ici et sans lien avec la conservation : non jouées.
--  10. Navigation unique, rejouée telle quelle : phase 1 (appliquée le 11/11), 20261110_navigation_unique_1_reglages.sql
--      (règle d'écriture des réglages) puis 20261110_navigation_unique_2_menage.sql (colonnes de themes et de qcm retirées,
--      themes.updated_by_email comprise ; _anonymiser_stagiaire recréée dans sa version propre, fiches_suivi conditionnelle) ;
--      puis phase 2 (appliquée le 11/11 à 14 h 55), 20261111_navigation_unique_3_phase2.sql (fiches_suivi retirée,
--      current_week_lundi vidé) : c'est l'état réel avant Q5. La table qcm n'existe ici que pour ses colonnes retirées.
--      Variante « complète » (fiches_suivi encore là, état d'avant la phase 2) : ajouter -v phase1_seule=1 au lancement.
-- Lancement (psql lit les fichiers rejoués par \ir, le serveur lit les extraits par pg_read_file : superutilisateur
-- local) :
--   psql -p <port> -U postgres -d cs -v ON_ERROR_STOP=1 \
--        -v migrations=<chemin absolu du dossier supabase/migrations, barres obliques> \
--        -f tests/sql/conservation-schema-minimal.sql
-- Puis la preuve : voir l'en-tête de tests/sql/conservation-preuve.sql.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
grant usage on schema auth, public to anon, authenticated, service_role;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
grant execute on all functions in schema auth to anon, authenticated, service_role;

-- Comme Supabase : tout nouvel objet de public est accordé aux rôles d'API (la RLS filtre). La migration doit donc
-- retirer elle-même ces droits : la preuve le vérifie.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- 2. Tables (colonnes et contraintes relevées sur la base réelle) -------------------------------------------------
-- lieux : colonnes du lot 5 (habillage du centre, centre de démonstration) relevées le 10/11 (schema-reel-colonnes-v2.txt).
create table public.lieux (id serial primary key, nom text not null unique, created_at timestamptz not null default now(),
  demonstration boolean not null default false, habillage text check (habillage is null or habillage in ('ecsr', 'ecf')),
  habillage_libre boolean not null default true);
create table public.promos (id serial primary key, lieu_id integer not null references public.lieux(id),
  nom text not null, date_debut date not null, date_fin date, created_at timestamptz not null default now());
create table public.stagiaires (id serial primary key, prenom text not null, ordre integer not null default 0,
  created_at timestamptz default now(), nom text, actif boolean not null default true, date_naissance date,
  promo_id integer not null references public.promos(id), anonymise_le timestamptz,
  constraint stagiaires_date_naissance_videe check (date_naissance is null),
  constraint stagiaires_promo_prenom_unique unique (promo_id, prenom));
create table public.profs (id serial primary key, nom text not null unique, ordre integer not null default 0,
  created_at timestamptz default now());
create table public.user_profiles (
  email text primary key,
  stagiaire_id integer references public.stagiaires(id) on delete set null,
  prof_id integer references public.profs(id) on delete set null,
  role text not null, invited_at timestamptz default now(), invited_by_email text, first_login_at timestamptz,
  is_admin boolean not null default false, anonymous_notes boolean not null default false,
  is_founder boolean not null default false, anon_changed_at timestamptz, anon_lock_until timestamptz, habillage text);
create table public.settings (id bigint generated always as identity primary key, key text not null, value text not null,
  updated_at timestamptz default now(), promo_id integer references public.promos(id),
  constraint settings_promo_key_unique unique nulls not distinct (promo_id, key));
create table public.planning_entries (id serial primary key, semaine_lundi date not null, day_index integer not null,
  half_day text not null, slot integer not null, activite text,
  prof_id integer references public.profs(id) on delete set null, sujet text,
  pedagogue_id integer references public.stagiaires(id) on delete set null, eleves_ids integer[] default '{}',
  notes text, created_at timestamptz default now(), updated_at timestamptz default now(), lane integer not null default 0,
  prof_ids integer[] not null default '{}', pedagogue_id_2 integer, eleves_ids_2 integer[] default '{}',
  salle_double boolean default false, benevoles_ids integer[] not null default '{}', prof_autre text,
  autonomie boolean not null default false, sujet_2 text, absences jsonb not null default '[]',
  promo_id integer not null references public.promos(id),
  constraint planning_entries_promo_unique unique (promo_id, semaine_lundi, day_index, half_day, slot, lane));
create table public.stagiaires_prive (stagiaire_id integer primary key references public.stagiaires(id) on delete cascade,
  date_naissance date, updated_at timestamptz not null default now());
create table public.dp_dossiers (id bigint generated always as identity primary key,
  stagiaire_id integer not null unique references public.stagiaires(id) on delete cascade,
  data jsonb not null default '{}', updated_by_who text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), promo_id integer not null references public.promos(id));
create table public.epcf_livrets (id bigint generated always as identity primary key,
  stagiaire_id integer not null unique references public.stagiaires(id) on delete cascade,
  data jsonb not null default '{}', updated_by_who text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), promo_id integer not null references public.promos(id));
create table public.fiches_suivi (stagiaire_id bigint primary key references public.stagiaires(id) on delete cascade,
  souhaits jsonb not null default '[]', besoins text, updated_at timestamptz not null default now(), updated_by_who text,
  promo_id integer not null references public.promos(id));
create table public.epcf_evaluations (id bigint generated always as identity primary key,
  stagiaire_id integer not null references public.stagiaires(id) on delete cascade, trame text not null,
  trame_version integer not null default 1, date_eval date not null default current_date,
  evaluateur_prof_id integer references public.profs(id), auto_eval boolean not null default false,
  contexte text not null default 'EPCF', meta jsonb not null default '{}', scores jsonb not null default '{}',
  competences_acquises jsonb not null default '[]', commentaire text, created_by uuid default auth.uid(),
  updated_by_who text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  promo_id integer not null references public.promos(id));
create table public.evaluations (id serial primary key,
  stagiaire_id integer not null references public.stagiaires(id) on delete cascade, type text not null,
  theme_numero integer, theme_titre text, competence_code text, controle_libelle text, note numeric,
  note_max numeric default 20, observation text, date_eval date not null default current_date, created_by_email text,
  updated_by_email text, created_at timestamptz default now(), updated_at timestamptz default now(),
  qcm_attempt_id bigint, promo_id integer not null references public.promos(id));
create table public.evaluations_audit (id serial primary key, evaluation_id integer, action text not null,
  before_data jsonb, after_data jsonb, changed_by_email text, changed_at timestamptz default now(),
  promo_id integer not null references public.promos(id));
create table public.passages (id serial primary key, date date not null,
  stagiaire_id integer not null references public.stagiaires(id) on delete cascade, type text not null,
  resultat text not null, remplacant_id integer references public.stagiaires(id) on delete set null,
  origine text not null default 'Manuel', commentaire text, semaine_lundi date, created_at timestamptz default now(),
  created_by_who text, updated_by_who text, prof_id bigint references public.profs(id), avec_eleve boolean,
  promo_id integer not null references public.promos(id));
create table public.passages_audit (id serial primary key, passage_id integer, action text not null, before_data jsonb,
  after_data jsonb, changed_by_who text, changed_at timestamptz default now(),
  promo_id integer not null references public.promos(id));
create table public.agenda_events (id bigint generated always as identity primary key, date_start date not null,
  date_end date, type text not null default 'autre', title text not null, description text, location text,
  created_by_email text, created_at timestamptz default now(), updated_at timestamptz default now(),
  promo_id integer not null references public.promos(id));
create table public.qcm_signalements (id bigserial primary key, question_id bigint not null, email text not null,
  stagiaire_id bigint references public.stagiaires(id) on delete set null, motif text not null default 'autre',
  commentaire text, statut text not null default 'ouvert', created_at timestamptz not null default now(),
  traite_at timestamptz, traite_par_email text, option_id bigint, option_texte text);
create table public.themes (id serial primary key, numero integer, titre text not null, categorie text,
  type text not null default 'theme', statut text not null default 'À faire', date_fait date, notes text,
  ordre integer default 0, updated_by_email text, updated_at timestamptz default now(), date_qcm date, code text);
create table public.themes_progression (promo_id integer not null references public.promos(id),
  theme_id integer not null references public.themes(id) on delete cascade, statut text not null default 'À faire',
  date_fait date, date_qcm date, notes text, updated_by_email text, updated_at timestamptz not null default now(),
  primary key (promo_id, theme_id));
-- qcm : seules les colonnes que la navigation unique (phase 1) retire, relevées le 10/11 (schema-reel-colonnes-v2.txt).
create table public.qcm (id serial primary key, published boolean not null default false, published_by_email text,
  published_at timestamptz, exam_nb_questions integer, exam_question_ids jsonb, exam_draw_mode text,
  exam_seconds_per_question integer not null default 30, exam_ferme_a timestamptz);
create table public.conditions_acceptations (id bigserial primary key, email text not null, version text not null,
  accepted_at timestamptz not null default now(), unique (email, version));
create table public.planning_jours_off (id bigint generated always as identity primary key, semaine_lundi date not null,
  day_index integer not null, label text, created_at timestamptz default now(), created_by_who text,
  promo_id integer not null references public.promos(id),
  constraint planning_jours_off_promo_unique unique (promo_id, semaine_lundi, day_index));

-- 3. Avant le lot 4, puis son étape 1 rejouée telle quelle --------------------------------------------------------
create or replace function public.is_founder() returns boolean
language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select exists (
    select 1 from user_profiles
    where lower(email) = lower((select auth.jwt() ->> 'email'))
      and is_founder = true
  );
$function$;

create or replace function public.peut_acceder_promo(p integer) returns boolean
language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select exists (select 1 from promos pr where pr.id = p)
     and exists (
       select 1 from user_profiles up
       where lower(up.email) = lower((select auth.jwt() ->> 'email'))
         and (   up.is_founder
              or up.role in ('prof', 'admin')
              or exists (select 1 from stagiaires s
                          where s.id = up.stagiaire_id and s.promo_id = p))
     );
$function$;

create or replace function public.promo_par_defaut()
returns integer language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with moi as (
    select up.stagiaire_id, (up.is_founder or up.role in ('prof', 'admin')) as tout_voir
    from user_profiles up
    where lower(up.email) = lower((select auth.jwt() ->> 'email'))
    limit 1
  )
  select coalesce(
    (select s.promo_id from moi join stagiaires s on s.id = moi.stagiaire_id),
    (select pr.id from promos pr, moi
      where moi.tout_voir and (pr.date_fin is null or pr.date_fin >= current_date)
      order by pr.date_debut, pr.id limit 1),
    (select pr.id from promos pr, moi
      where moi.tout_voir
      order by pr.date_debut desc, pr.id desc limit 1)
  );
$$;

create or replace function public.promo_courante()
returns integer language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  brut text := nullif(current_setting('request.headers', true), '');
  entete text;
begin
  if brut is not null then
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
$$;

create or replace function public.lieu_courant()
returns integer language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select pr.lieu_id from promos pr where pr.id = promo_courante();
$$;

revoke all on function public.peut_acceder_promo(integer), public.promo_par_defaut(),
  public.promo_courante(), public.lieu_courant() from public;
grant execute on function public.peut_acceder_promo(integer), public.promo_par_defaut(),
  public.promo_courante(), public.lieu_courant() to anon, authenticated, service_role;

\ir ../../supabase/migrations/20261028_roles_1_fondations.sql

-- Extraits : une fonction ou un passage d'un fichier de migration du dépôt, joué tel quel. Un extrait introuvable fait
-- échouer le chargement.
create function pg_temp.extrait(p_fichier text, p_motif text) returns text language plpgsql as $f$
declare v text;
begin
  v := (regexp_match(pg_read_file(current_setting('schema.migrations') || '/' || p_fichier), p_motif))[1];
  if v is null then
    raise exception 'schéma minimal : extrait introuvable dans % (%)', p_fichier, p_motif;
  end if;
  return v;
end $f$;
create function pg_temp.fonction_lot4(p_nom text) returns void language plpgsql as $f$
begin
  -- Du titre de la fonction à la fin de son corps (premier « $function$; » qui suit).
  execute pg_temp.extrait('20261028_roles_2_fonctions.sql',
    '(CREATE OR REPLACE FUNCTION public\.' || p_nom || '\(.*?\$function\$;)');
end $f$;
select set_config('schema.migrations', :'migrations', false) is not null as dossier_lu;

-- 4. Étape 2 du lot 4 : les fonctions de lecture des droits -------------------------------------------------------
select pg_temp.fonction_lot4(n)
  from unnest(array['peut_acceder_promo', 'promo_par_defaut', 'promo_courante', 'my_stagiaire_id', 'is_admin', 'is_prof',
                    'is_founder']) with ordinality u(n, o) order by o;

-- 5. Émargement (23/10) tel quel, puis les versions du lot 4 ------------------------------------------------------
\ir ../../supabase/migrations/20261023_emargement.sql
select pg_temp.fonction_lot4(n)
  from unnest(array['emargement_feuille', 'emargement_ouvrir', 'emargement_signer']) with ordinality u(n, o) order by o;

-- 6. Journal des effacements (05/10), sa règle de lecture (lot 4), les quatre fonctions d'effacement du lot 4 ------
do $$ begin
  execute pg_temp.extrait('20261005_effacement_donnees.sql',
    '(create table public\.effacements_journal \(.*?revoke all on sequence public\.effacements_journal_id_seq[^;]*;)');
  execute pg_temp.extrait('20261028_roles_3_regles.sql',
    '(create policy effacements_journal_lecture on public\.effacements_journal.*?\r?\n  \);)');
end $$;
select pg_temp.fonction_lot4(n)
  from unnest(array['_anonymiser_stagiaire', 'anonymiser_promo', 'anonymiser_stagiaire', 'etat_anonymisation_promo'])
       with ordinality u(n, o) order by o;
-- Droits posés le 05/10 (lignes 134, 157-158, 182-183, 214-215), que le create or replace du lot 4 a gardés.
revoke all on function public._anonymiser_stagiaire(integer) from anon, public, authenticated;
revoke all on function public.anonymiser_stagiaire(integer) from anon, public;
grant execute on function public.anonymiser_stagiaire(integer) to authenticated;
revoke all on function public.etat_anonymisation_promo() from anon, public;
grant execute on function public.etat_anonymisation_promo() to authenticated;
revoke all on function public.anonymiser_promo() from anon, public;
grant execute on function public.anonymiser_promo() to authenticated;

-- 7. Questionnaires (Q3), tels quels -----------------------------------------------------------------------------
\ir ../../supabase/migrations/20261108_questionnaires.sql

-- 8. Registre qualité (Q4), tel quel : sa table, son déclencheur et effacer_registre_qualite() (version du lot Q4) ----
-- Il lit signalements_app (20261028_signalements_app.sql, qui lit profs et user_profiles.prof_id, déjà ici) et peut_gerer_qualite() (point 7).
\ir ../../supabase/migrations/20261028_signalements_app.sql
\ir ../../supabase/migrations/20261109_registre_qualite.sql

-- 9. Suite du lot 5, étape 4 : les fonctions de la direction (sections 3 et 4), droits compris ------------------------
do $$ begin
  execute pg_temp.extrait('20261111_espaces_4_donnees.sql',
    '(create function public\.etat_anonymisation_promo\(p_promo integer\).*?grant execute on function public\.purger_benevoles\(integer\[\], integer\) to authenticated;)');
end $$;

-- 10. Navigation unique, phases 1 et 2, telles quelles (phase 2 sautée avec -v phase1_seule=1) ---------------------------------------------------------------
\ir ../../supabase/migrations/20261110_navigation_unique_1_reglages.sql
\ir ../../supabase/migrations/20261110_navigation_unique_2_menage.sql
\if :{?phase1_seule}
\else
\ir ../../supabase/migrations/20261111_navigation_unique_3_phase2.sql
\endif
