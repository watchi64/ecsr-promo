-- E-learning, lot 1 (lecture et temps actif), tâche 2 : les traces du travail en autonomie, côté base. NON APPLIQUÉE EN
-- PRODUCTION : attend l'accord de Timy, la validation des textes (conditions d'utilisation, registre des traitements) et la
-- date de leur version (voir _autonomie_version_conditions plus bas). Spec docs/superpowers/specs/2026-11-12-e-learning-design.md
-- (§ 6) ; plan docs/superpowers/plans/2026-11-12-e-learning-lot-1-lecture-temps-actif.md (Task 2).
-- Retour : 20261114_autonomie_1_traces_retour.sql. Preuve : tests/sql/autonomie-preuve.sql ; ordre des verrous entre deux
-- sessions : tests/sql/autonomie-concurrence.sh (base locale jetable seulement).
--
-- AVANT LA PRODUCTION : remplacer la sentinelle '9999-12-31' de _autonomie_version_conditions par la date de publication des
-- conditions qui décrivent cette collecte (AAAA-MM-JJ). Tant que la sentinelle est là, la base n'écrit AUCUNE trace, quelles
-- que soient les acceptations en base (fermeture dure, voir _autonomie_permis). Durcir accepter_conditions contre une version
-- inconnue (aujourd'hui elle accepte toute version bien formée) est une tâche à part, d'un autre chantier.
--
-- La base refuse elle-même toute trace hors des conditions permises ; l'app n'est qu'un client.
--   cours_lectures         une ligne par stagiaire, promo et cours : premier accès (ouvert_le), dernier (vu_le), fin du cours
--                          atteinte (fin_atteinte, ne redevient jamais fausse), cours lu (lu_le, posé une fois, gardé même si
--                          le cours change ensuite), dernière section vue (section, 80 caractères au plus).
--   autonomie_temps        le temps actif, cumulé par stagiaire, promo, jour (de Paris), genre (cours ou qcm) et ressource
--                          (identifiant du cours ou du QCM, en texte).
--   autonomie_oppositions  droit d'opposition : un stagiaire inscrit ici n'a plus aucune trace écrite. Aucun droit pour les
--                          rôles de l'API ; remplie par autonomie_opposer, réservée au fondateur.
-- Promo d'une trace : celle du stagiaire au moment de l'écriture, et elle fait partie de la clé des deux tables. Un stagiaire
-- qui change de promo commence des lignes neuves dans la nouvelle ; celles de l'ancienne ne bougent plus (séparation stricte
-- des promos). Le plancher de lecture compte le temps sur le cours DANS la promo ; le plafond de 8 h compte la journée du
-- stagiaire toutes promos confondues.
-- Écriture : seulement par autonomie_tracer_cours et autonomie_tracer_qcm (security definer). Dans cet ordre :
--   1. compte qui n'est pas un compte stagiaire (aucune fiche dans la promo affichée, ou compte d'équipe : fondateur,
--      is_admin, affectation de formateur, de direction ou de siège, même avec une fiche) : « autonomie: Réservé aux
--      stagiaires. » ;
--   puis le verrou du stagiaire (voir « Concurrence ») ;
--   2. interrupteur de la promo du stagiaire éteint (réglage autonomie_active différent de 'true') : refus silencieux ;
--   3. conditions d'utilisation non acceptées dans une version publiée au moins égale à la version exigée : refus
--      silencieux. Sentinelle : refus de tout ;
--   3 bis. stagiaire inscrit dans autonomie_oppositions, ou fiche déjà passée par l'étape 1 de la conservation
--      (stagiaires.efface_le posé) : refus silencieux ;
--   4. secondes hors de 0 à 60 : « autonomie: Durée invalide. » ; au-delà de 8 h (28 800 s) cumulées dans le jour pour le
--      stagiaire, les secondes en trop sont ignorées ;
--   5. cours non publié ou inconnu, QCM inconnu : « autonomie: Ressource introuvable. » ;
--   6. section tronquée à 80 caractères ;
--   7. cours : la ligne de cours_lectures naît ou se met à jour, les secondes s'ajoutent à autonomie_temps ; lu_le est posé
--      quand la fin est atteinte et que le temps du stagiaire sur ce cours dans cette promo (tous jours) atteint le plancher
--      greatest(1, round(mots / 200.0)) * 60 * 0.3, mots = nombre de mots de corps_md au moment de l'appel.
-- Concurrence : chaque écriture, l'opposition et l'effacement prennent, dans cet ordre, le verrou de la ligne de la fiche
-- (key share ; l'effacement de la conservation la tient déjà en for update ou no key update) puis le verrou consultatif
-- (hashtext('autonomie_temps'), id de la fiche), avant tout contrôle. En READ COMMITTED, chaque instruction après l'attente lit
-- un instantané neuf : une opposition ou un effacement validés pendant l'attente sont vus, et rien ne s'écrit. Une seule clé
-- par fiche, toujours prise après la ligne de la fiche : pas d'interblocage entre ces fonctions.
-- Lecture : une règle « select » par table, sur le modèle de qcm_attempts_lecture (titres, migration 3) : promo affichée, et
-- geste notes.lire (équipe de la promo, direction du centre, fondateur), ou ses propres lignes pour le stagiaire TANT QUE
-- l'interrupteur de la promo est allumé (éteint : il ne voit plus rien, les lignes restent en base et l'équipe les lit
-- toujours). Aucun insert, update ni delete pour authenticated. Le siège ne lit rien (il n'affiche aucune promo).
-- Sort des données. Fiche supprimée : clé étrangère « on delete cascade » (comme qcm_attempts). Changement de promo : voir
-- plus haut. Conservation : le travail en autonomie est une donnée de la catégorie « formation + 12 mois, puis suppression »
-- (textes de données personnelles du lot), celle que vide l'étape 1, pas celle des résultats (3 ans). Quand l'étape 1 marque
-- une fiche (stagiaires.efface_le passe de nul à une date : effacer_sur_demande, effacer_promo_etape1, ou l'étape 2 qui joue
-- l'étape 1 manquante), le déclencheur stagiaires_autonomie_effacer supprime ses lectures, son temps (toutes promos) et son
-- éventuelle opposition (plus rien ne peut s'écrire pour une fiche effacée : l'opposition ne sert plus et c'est une donnée de
-- la personne). Les tentatives de QCM restent (3 ans). Aucune fonction de la conservation n'est modifiée.
-- Interrupteur : la clé autonomie_active de settings ne s'écrit (création, modification, suppression, renommage vers elle ou
-- depuis elle) que par le fondateur hors aperçu (est_fondateur()), par trois règles RESTRICTIVES (to public, comme la règle
-- permissive), qui s'ajoutent en « et » à la règle settings_ecriture (générée par le chantier des titres, non modifiée ici).
-- La lecture des réglages ne change pas : le stagiaire lit toujours l'interrupteur de sa promo.
-- Refus en « autonomie: <phrase> », la phrase étant montrée telle quelle par l'app.
set local lock_timeout = '3s';

do $garde$
begin
  if to_regclass('public.cours_lectures') is not null or to_regclass('public.autonomie_temps') is not null
     or to_regclass('public.autonomie_oppositions') is not null then
    raise exception 'autonomie_1 : une table de l''autonomie existe déjà, migration déjà appliquée ?';
  end if;
end $garde$;

-- 1. Tables ----------------------------------------------------------------------------------------------------------
create table public.cours_lectures (
  stagiaire_id integer not null references public.stagiaires(id) on delete cascade,
  promo_id integer not null references public.promos(id),
  cours_id uuid not null references public.cours(id) on delete cascade,
  ouvert_le timestamptz not null,
  vu_le timestamptz not null,
  lu_le timestamptz,
  fin_atteinte boolean not null default false,
  section text check (section is null or char_length(section) <= 80),
  primary key (stagiaire_id, promo_id, cours_id),
  check (lu_le is null or fin_atteinte)
);
create index cours_lectures_promo_idx on public.cours_lectures (promo_id, cours_id);

create table public.autonomie_temps (
  stagiaire_id integer not null references public.stagiaires(id) on delete cascade,
  promo_id integer not null references public.promos(id),
  jour date not null,
  genre text not null check (genre in ('cours', 'qcm')),
  ressource text not null check (char_length(ressource) between 1 and 64),
  secondes integer not null check (secondes between 0 and 28800),
  primary key (stagiaire_id, promo_id, jour, genre, ressource)
);
create index autonomie_temps_promo_idx on public.autonomie_temps (promo_id, jour);
create index autonomie_temps_jour_idx on public.autonomie_temps (stagiaire_id, jour);

create table public.autonomie_oppositions (
  stagiaire_id integer primary key references public.stagiaires(id) on delete cascade,
  depuis timestamptz not null default now()
);

alter table public.cours_lectures enable row level security;
alter table public.autonomie_temps enable row level security;
alter table public.autonomie_oppositions enable row level security;

revoke all on public.cours_lectures, public.autonomie_temps, public.autonomie_oppositions from public, anon, authenticated;
grant select on public.cours_lectures, public.autonomie_temps to authenticated;

-- 2. Lecture ---------------------------------------------------------------------------------------------------------
create policy cours_lectures_lecture on public.cours_lectures
  as permissive for select to authenticated
  using (promo_id = (select public.promo_courante())
         and ((select public.geste_promo((select public.promo_courante()), 'notes.lire'))
              or (stagiaire_id = (select public.my_stagiaire_id())
                  and exists (select 1 from public.settings st
                               where st.promo_id = (select public.promo_courante())
                                 and st.key = 'autonomie_active' and st.value = 'true'))));

create policy autonomie_temps_lecture on public.autonomie_temps
  as permissive for select to authenticated
  using (promo_id = (select public.promo_courante())
         and ((select public.geste_promo((select public.promo_courante()), 'notes.lire'))
              or (stagiaire_id = (select public.my_stagiaire_id())
                  and exists (select 1 from public.settings st
                               where st.promo_id = (select public.promo_courante())
                                 and st.key = 'autonomie_active' and st.value = 'true'))));

-- 2 bis. Interrupteur réservé au fondateur -----------------------------------------------------------------------------
create policy settings_autonomie_ajout on public.settings
  as restrictive for insert to public
  with check (key <> 'autonomie_active' or (select public.est_fondateur()));
create policy settings_autonomie_modification on public.settings
  as restrictive for update to public
  using (key <> 'autonomie_active' or (select public.est_fondateur()))
  with check (key <> 'autonomie_active' or (select public.est_fondateur()));
create policy settings_autonomie_suppression on public.settings
  as restrictive for delete to public
  using (key <> 'autonomie_active' or (select public.est_fondateur()));

-- 3. Fonctions internes ----------------------------------------------------------------------------------------------
-- Version des conditions d'utilisation qui décrit cette collecte : un stagiaire n'a de traces que s'il a accepté une version
-- publiée au moins égale à celle-ci. SENTINELLE '9999-12-31' : _autonomie_permis refuse tout tant qu'elle est là (fermeture
-- dure, même si un stagiaire a « accepté » la version 9999-12-31 par accepter_conditions). À REMPLACER par la date de
-- publication des conditions (AAAA-MM-JJ) avant d'appliquer cette migration en production.
create function public._autonomie_version_conditions()
returns text language sql immutable set search_path to 'public', 'pg_temp' as $f$
  select '9999-12-31'::text;
$f$;

-- Le stagiaire qui appelle, ou nul : une fiche dans la promo affichée (my_stagiaire_id, qui rend aussi la fiche en aperçu
-- stagiaire, fondateur compris) ET un compte qui n'est pas d'équipe (même définition que la conservation : is_admin,
-- is_founder ou une affectation, quelle qu'elle soit). C'est ce second contrôle qui écarte le fondateur et toute l'équipe,
-- aperçu ou non.
create function public._autonomie_stagiaire()
returns integer language sql stable security definer set search_path to 'public', 'pg_temp' as $f$
  select s.id
    from (select my_stagiaire_id() as id) s
   where s.id is not null
     and not exists (select 1 from user_profiles u
                      where lower(u.email) = lower((select auth.jwt() ->> 'email'))
                        and (u.is_admin or u.is_founder
                             or exists (select 1 from affectations a where lower(a.email) = lower(u.email))));
$f$;

-- Le verrou d'une fiche, toujours dans cet ordre : la ligne de stagiaires (key share), puis le verrou consultatif. Rend la
-- promo de la fiche, lue après l'attente (nul si la fiche n'existe pas).
create function public._autonomie_verrou(p_stagiaire integer)
returns integer language plpgsql security definer set search_path to 'public', 'pg_temp' as $f$
declare
  v_promo integer;
begin
  perform 1 from stagiaires where id = p_stagiaire for key share;
  perform pg_advisory_xact_lock(hashtext('autonomie_temps'), p_stagiaire);
  select promo_id into v_promo from stagiaires where id = p_stagiaire;
  return v_promo;
end $f$;

-- Vrai si une trace peut s'écrire pour ce stagiaire dans cette promo : version des conditions datée (pas la sentinelle),
-- interrupteur de la promo allumé, fiche non effacée, aucune opposition, et une acceptation (adresse du jeton) d'une
-- version publiée au moins égale à la version exigée. Une version est une date de publication, avec une lettre éventuelle
-- (« 2026-11-20b ») : on compare ses dix premiers caractères ; une version datée après aujourd'hui (Paris) n'a pas pu être
-- publiée et ne compte pas (accepter_conditions accepte toute version bien formée).
create function public._autonomie_permis(p_stagiaire integer, p_promo integer)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $f$
  select _autonomie_version_conditions() <> '9999-12-31'
     and exists (select 1 from settings st
                  where st.promo_id = p_promo and st.key = 'autonomie_active' and st.value = 'true')
     and exists (select 1 from stagiaires s where s.id = p_stagiaire and s.efface_le is null)
     and not exists (select 1 from autonomie_oppositions o where o.stagiaire_id = p_stagiaire)
     and exists (select 1 from conditions_acceptations ca
                  where lower(ca.email) = lower((select auth.jwt() ->> 'email'))
                    and left(ca.version, 10) >= _autonomie_version_conditions()
                    and left(ca.version, 10) <= to_char(now() at time zone 'Europe/Paris', 'YYYY-MM-DD'));
$f$;

-- Ajoute des secondes au temps du jour, dans la limite de 8 h par jour et par stagiaire (toutes promos et ressources) ;
-- rend les secondes réellement ajoutées. L'appelant tient déjà le verrou de la fiche (_autonomie_verrou).
create function public._autonomie_ajouter_temps(p_stagiaire integer, p_promo integer, p_genre text, p_ressource text,
                                                p_secondes integer)
returns integer language plpgsql security definer set search_path to 'public', 'pg_temp' as $f$
declare
  v_jour date := (now() at time zone 'Europe/Paris')::date;
  v_deja bigint;
  v_ajout integer;
begin
  select coalesce(sum(secondes), 0) into v_deja from autonomie_temps where stagiaire_id = p_stagiaire and jour = v_jour;
  v_ajout := least(p_secondes, greatest(0, 28800 - v_deja))::integer;
  if v_ajout > 0 then
    insert into autonomie_temps (stagiaire_id, promo_id, jour, genre, ressource, secondes)
    values (p_stagiaire, p_promo, v_jour, p_genre, p_ressource, v_ajout)
    on conflict (stagiaire_id, promo_id, jour, genre, ressource) do update
      set secondes = autonomie_temps.secondes + excluded.secondes;
  end if;
  return v_ajout;
end $f$;

-- Déclencheur de l'étape 1 de la conservation : la fiche vient d'être marquée effacée (efface_le de nul à une date), ses
-- traces (toutes promos) et son opposition partent. La ligne de la fiche est déjà verrouillée par la mise à jour ; le
-- verrou consultatif vient ensuite (même ordre que les écritures), et les suppressions qui le suivent voient toute écriture
-- validée pendant l'attente.
create function public._autonomie_effacer_fiche()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp' as $f$
begin
  perform pg_advisory_xact_lock(hashtext('autonomie_temps'), new.id);
  delete from cours_lectures where stagiaire_id = new.id;
  delete from autonomie_temps where stagiaire_id = new.id;
  delete from autonomie_oppositions where stagiaire_id = new.id;
  return null;
end $f$;
create trigger stagiaires_autonomie_effacer
  after update of efface_le on public.stagiaires
  for each row when (old.efface_le is null and new.efface_le is not null)
  execute function public._autonomie_effacer_fiche();

revoke all on function public._autonomie_version_conditions(), public._autonomie_stagiaire(),
  public._autonomie_verrou(integer), public._autonomie_permis(integer, integer),
  public._autonomie_ajouter_temps(integer, integer, text, text, integer), public._autonomie_effacer_fiche()
  from public, anon, authenticated, service_role;

-- 4. Écriture --------------------------------------------------------------------------------------------------------
-- Rend vrai si le cours est lu (dans la promo du stagiaire) après l'appel ; faux sur un refus silencieux.
create function public.autonomie_tracer_cours(p_cours uuid, p_secondes integer, p_fin boolean, p_section text)
returns boolean language plpgsql security definer set search_path to 'public', 'pg_temp' as $f$
declare
  v_sid integer := _autonomie_stagiaire();
  v_promo integer;
  v_corps text;
  v_mots integer;
  v_total bigint;
  l cours_lectures;
begin
  if v_sid is null then
    raise exception 'autonomie: Réservé aux stagiaires.';
  end if;
  -- Verrou d'abord : tout ce qui suit est lu après l'attente.
  v_promo := _autonomie_verrou(v_sid);
  if not _autonomie_permis(v_sid, v_promo) then
    return false;
  end if;
  if p_secondes is null or p_secondes < 0 or p_secondes > 60 then
    raise exception 'autonomie: Durée invalide.';
  end if;
  select corps_md into v_corps from cours where id = p_cours and published;
  if not found then
    raise exception 'autonomie: Ressource introuvable.';
  end if;

  perform _autonomie_ajouter_temps(v_sid, v_promo, 'cours', p_cours::text, p_secondes);
  insert into cours_lectures (stagiaire_id, promo_id, cours_id, ouvert_le, vu_le, fin_atteinte, section)
  values (v_sid, v_promo, p_cours, now(), now(), coalesce(p_fin, false), left(p_section, 80))
  on conflict (stagiaire_id, promo_id, cours_id) do update
    set vu_le = excluded.vu_le,
        fin_atteinte = cours_lectures.fin_atteinte or excluded.fin_atteinte,
        section = coalesce(excluded.section, cours_lectures.section)
  returning * into l;

  if l.lu_le is null and l.fin_atteinte then
    select coalesce(sum(secondes), 0) into v_total
      from autonomie_temps
     where stagiaire_id = v_sid and promo_id = v_promo and genre = 'cours' and ressource = p_cours::text;
    select count(*) into v_mots from regexp_split_to_table(v_corps, '\s+') w where w <> '';
    if v_total >= greatest(1, round(v_mots / 200.0)) * 60 * 0.3 then
      update cours_lectures set lu_le = now()
       where stagiaire_id = v_sid and promo_id = v_promo and cours_id = p_cours
      returning * into l;
    end if;
  end if;
  return l.lu_le is not null;
end $f$;

create function public.autonomie_tracer_qcm(p_qcm bigint, p_secondes integer)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $f$
declare
  v_sid integer := _autonomie_stagiaire();
  v_promo integer;
begin
  if v_sid is null then
    raise exception 'autonomie: Réservé aux stagiaires.';
  end if;
  -- Verrou d'abord : tout ce qui suit est lu après l'attente.
  v_promo := _autonomie_verrou(v_sid);
  if not _autonomie_permis(v_sid, v_promo) then
    return;
  end if;
  if p_secondes is null or p_secondes < 0 or p_secondes > 60 then
    raise exception 'autonomie: Durée invalide.';
  end if;
  if p_qcm is null or not exists (select 1 from qcm where id = p_qcm) then
    raise exception 'autonomie: Ressource introuvable.';
  end if;
  perform _autonomie_ajouter_temps(v_sid, v_promo, 'qcm', p_qcm::text, p_secondes);
end $f$;

-- 5. Lectures de la promo (« N sur T l'ont lu ») ---------------------------------------------------------------------
-- Par cours, le nombre de stagiaires actifs qui l'ont lu DANS la promo affichée (lignes de cette promo, y compris celles d'un
-- stagiaire parti depuis dans une autre promo). Sans le geste notes.lire sur la promo affichée : aucune ligne, sans erreur
-- (comme notes_stagiaires_visibles).
create function public.autonomie_lectures_promo()
returns table (cours_id uuid, lus integer)
language sql stable security definer set search_path to 'public', 'pg_temp' as $f$
  select cl.cours_id, count(*)::integer
    from cours_lectures cl
    join stagiaires s on s.id = cl.stagiaire_id
   where (select geste_promo(promo_courante(), 'notes.lire'))
     and cl.promo_id = (select promo_courante())
     and s.actif
     and cl.lu_le is not null
   group by cl.cours_id;
$f$;

-- 6. Opposition ------------------------------------------------------------------------------------------------------
-- Le fondateur (hors aperçu) inscrit le stagiaire et efface ses traces (toutes promos). Verrou de la fiche avant
-- l'inscription : une écriture en cours finit d'abord, et sa trace est effacée ici ; une écriture qui attend verra
-- l'opposition. Rejouable : un second appel garde la date.
create function public.autonomie_opposer(p_stagiaire integer)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $f$
begin
  if not est_fondateur() then
    raise exception 'autonomie: Réservé au fondateur.';
  end if;
  if p_stagiaire is null or not exists (select 1 from stagiaires where id = p_stagiaire) then
    raise exception 'autonomie: Fiche introuvable.';
  end if;
  perform _autonomie_verrou(p_stagiaire);
  insert into autonomie_oppositions (stagiaire_id) values (p_stagiaire) on conflict (stagiaire_id) do nothing;
  delete from cours_lectures where stagiaire_id = p_stagiaire;
  delete from autonomie_temps where stagiaire_id = p_stagiaire;
end $f$;

revoke all on function public.autonomie_tracer_cours(uuid, integer, boolean, text), public.autonomie_tracer_qcm(bigint, integer),
  public.autonomie_lectures_promo(), public.autonomie_opposer(integer) from public, anon, authenticated, service_role;
grant execute on function public.autonomie_tracer_cours(uuid, integer, boolean, text), public.autonomie_tracer_qcm(bigint, integer),
  public.autonomie_lectures_promo(), public.autonomie_opposer(integer) to authenticated;
