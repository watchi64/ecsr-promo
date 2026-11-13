-- E-learning, lot 1 (lecture et temps actif), tâche 2 : les traces du travail en autonomie, côté base. NON APPLIQUÉE EN
-- PRODUCTION : attend l'accord de Timy, la validation des textes (conditions d'utilisation, registre des traitements) et la
-- date de leur version (voir _autonomie_version_conditions plus bas). Spec docs/superpowers/specs/2026-11-12-e-learning-design.md
-- (§ 6) ; plan docs/superpowers/plans/2026-11-12-e-learning-lot-1-lecture-temps-actif.md (Task 2).
-- Retour : 20261114_autonomie_1_traces_retour.sql. Preuve : tests/sql/autonomie-preuve.sql.
--
-- La base refuse elle-même toute trace hors des conditions permises ; l'app n'est qu'un client.
--   cours_lectures         une ligne par stagiaire et par cours : premier accès (ouvert_le), dernier (vu_le), fin du cours
--                          atteinte (fin_atteinte, ne redevient jamais fausse), cours lu (lu_le, posé une fois, gardé même si
--                          le cours change ensuite), dernière section vue (section, 80 caractères au plus).
--   autonomie_temps        le temps actif, cumulé par stagiaire, jour (de Paris), genre (cours ou qcm) et ressource
--                          (identifiant du cours ou du QCM, en texte).
--   autonomie_oppositions  droit d'opposition : un stagiaire inscrit ici n'a plus aucune trace écrite. Aucun droit pour les
--                          rôles de l'API ; remplie par autonomie_opposer, réservée au fondateur.
-- Promo d'une trace : celle du stagiaire au moment de l'écriture (mise à jour à chaque écriture de la ligne).
-- Écriture : seulement par autonomie_tracer_cours et autonomie_tracer_qcm (security definer). Dans cet ordre :
--   1. compte qui n'est pas un compte stagiaire (aucune fiche dans la promo affichée, ou compte d'équipe : fondateur,
--      is_admin, affectation de formateur, de direction ou de siège, même avec une fiche) : « autonomie: Réservé aux
--      stagiaires. » ;
--   2. interrupteur de la promo du stagiaire éteint (réglage autonomie_active différent de 'true') : refus silencieux ;
--   3. conditions d'utilisation non acceptées dans la version exigée (_autonomie_version_conditions) : refus silencieux ;
--   3 bis. stagiaire inscrit dans autonomie_oppositions : refus silencieux ;
--   4. secondes hors de 0 à 60 : « autonomie: Durée invalide. » ; au-delà de 8 h (28 800 s) cumulées dans le jour pour le
--      stagiaire, les secondes en trop sont ignorées ;
--   5. cours non publié ou inconnu, QCM inconnu : « autonomie: Ressource introuvable. » ;
--   6. section tronquée à 80 caractères ;
--   7. cours : la ligne de cours_lectures naît ou se met à jour, les secondes s'ajoutent à autonomie_temps ; lu_le est posé
--      quand la fin est atteinte et que le temps du stagiaire sur ce cours (tous jours) atteint le plancher
--      greatest(1, round(mots / 200.0)) * 60 * 0.3, mots = nombre de mots de corps_md au moment de l'appel.
-- Lecture : une règle « select » par table, sur le modèle de qcm_attempts_lecture (titres, migration 3) : promo affichée, et
-- geste notes.lire (équipe de la promo, direction du centre, fondateur), ou ses propres lignes pour le stagiaire TANT QUE
-- l'interrupteur de la promo est allumé (éteint : il ne voit plus rien, les lignes restent en base et l'équipe les lit
-- toujours). Aucun insert, update ni delete pour authenticated. Le siège ne lit rien (il n'affiche aucune promo).
-- Sort des données (R2) : celui des tentatives de QCM (qcm_attempts). Fiche supprimée : clé étrangère « on delete cascade »
-- (comme qcm_attempts). Changement de promo : les lignes gardent la promo où elles ont été écrites (aucun mécanisme ne
-- déplace celles de qcm_attempts). Effacement par la conservation (étapes 1 et 2, effacement sur demande) : les fonctions
-- effacer_* gardent les résultats, qcm_attempts compris, rattachés à la fiche sans nom ; les traces restent de même. Aucune
-- fonction existante n'est modifiée.
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
  primary key (stagiaire_id, cours_id),
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
  primary key (stagiaire_id, jour, genre, ressource)
);
create index autonomie_temps_promo_idx on public.autonomie_temps (promo_id, jour);
create index autonomie_temps_ressource_idx on public.autonomie_temps (stagiaire_id, genre, ressource);

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

-- 3. Fonctions internes ----------------------------------------------------------------------------------------------
-- Version des conditions d'utilisation qui décrit cette collecte : un stagiaire n'a de traces que s'il a accepté cette
-- version ou une plus récente. SENTINELLE '9999-12-31' : aucune acceptation ne l'atteint, donc aucune trace n'est écrite
-- tant qu'elle reste là. À REMPLACER par la date de mise en ligne des conditions (format AAAA-MM-JJ, celui de
-- accepter_conditions) avant d'appliquer cette migration en production.
create function public._autonomie_version_conditions()
returns text language sql immutable set search_path to 'public', 'pg_temp' as $f$
  select '9999-12-31'::text;
$f$;

-- Le stagiaire qui appelle, ou nul : une fiche dans la promo affichée (my_stagiaire_id, nul dans tout aperçu autre que
-- stagiaire) et un compte qui n'est pas d'équipe (même définition que la conservation : is_admin, is_founder ou une
-- affectation, quelle qu'elle soit).
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

-- Vrai si une trace peut s'écrire pour ce stagiaire : interrupteur de sa promo allumé, conditions acceptées dans la
-- version exigée (adresse du jeton), aucune opposition.
create function public._autonomie_permis(p_stagiaire integer, p_promo integer)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $f$
  select exists (select 1 from settings st
                  where st.promo_id = p_promo and st.key = 'autonomie_active' and st.value = 'true')
     and exists (select 1 from conditions_acceptations ca
                  where lower(ca.email) = lower((select auth.jwt() ->> 'email'))
                    and ca.version >= _autonomie_version_conditions())
     and not exists (select 1 from autonomie_oppositions o where o.stagiaire_id = p_stagiaire);
$f$;

-- Ajoute des secondes au temps du jour, dans la limite de 8 h par jour et par stagiaire (toutes ressources) ; rend les
-- secondes réellement ajoutées. Verrou par stagiaire : deux onglets ne dépassent pas le plafond ensemble.
create function public._autonomie_ajouter_temps(p_stagiaire integer, p_promo integer, p_genre text, p_ressource text,
                                                p_secondes integer)
returns integer language plpgsql security definer set search_path to 'public', 'pg_temp' as $f$
declare
  v_jour date := (now() at time zone 'Europe/Paris')::date;
  v_deja bigint;
  v_ajout integer;
begin
  perform pg_advisory_xact_lock(hashtext('autonomie_temps'), p_stagiaire);
  select coalesce(sum(secondes), 0) into v_deja from autonomie_temps where stagiaire_id = p_stagiaire and jour = v_jour;
  v_ajout := least(p_secondes, greatest(0, 28800 - v_deja))::integer;
  if v_ajout > 0 then
    insert into autonomie_temps (stagiaire_id, promo_id, jour, genre, ressource, secondes)
    values (p_stagiaire, p_promo, v_jour, p_genre, p_ressource, v_ajout)
    on conflict (stagiaire_id, jour, genre, ressource) do update
      set secondes = autonomie_temps.secondes + excluded.secondes, promo_id = excluded.promo_id;
  end if;
  return v_ajout;
end $f$;

revoke all on function public._autonomie_version_conditions(), public._autonomie_stagiaire(),
  public._autonomie_permis(integer, integer), public._autonomie_ajouter_temps(integer, integer, text, text, integer)
  from public, anon, authenticated, service_role;

-- 4. Écriture --------------------------------------------------------------------------------------------------------
-- Rend vrai si le cours est lu après l'appel ; faux sur un refus silencieux.
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
  select promo_id into v_promo from stagiaires where id = v_sid;
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
  on conflict (stagiaire_id, cours_id) do update
    set promo_id = excluded.promo_id,
        vu_le = excluded.vu_le,
        fin_atteinte = cours_lectures.fin_atteinte or excluded.fin_atteinte,
        section = coalesce(excluded.section, cours_lectures.section)
  returning * into l;

  if l.lu_le is null and l.fin_atteinte then
    select coalesce(sum(secondes), 0) into v_total
      from autonomie_temps where stagiaire_id = v_sid and genre = 'cours' and ressource = p_cours::text;
    select count(*) into v_mots from regexp_split_to_table(v_corps, '\s+') w where w <> '';
    if v_total >= greatest(1, round(v_mots / 200.0)) * 60 * 0.3 then
      update cours_lectures set lu_le = now() where stagiaire_id = v_sid and cours_id = p_cours
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
  select promo_id into v_promo from stagiaires where id = v_sid;
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
-- Par cours, le nombre de stagiaires actifs de la promo affichée qui l'ont lu (lignes écrites dans cette promo). Sans le
-- geste notes.lire sur la promo affichée : aucune ligne, sans erreur (comme notes_stagiaires_visibles).
create function public.autonomie_lectures_promo()
returns table (cours_id uuid, lus integer)
language sql stable security definer set search_path to 'public', 'pg_temp' as $f$
  select cl.cours_id, count(*)::integer
    from cours_lectures cl
    join stagiaires s on s.id = cl.stagiaire_id
   where (select geste_promo(promo_courante(), 'notes.lire'))
     and cl.promo_id = (select promo_courante())
     and s.promo_id = (select promo_courante())
     and s.actif
     and cl.lu_le is not null
   group by cl.cours_id;
$f$;

-- 6. Opposition ------------------------------------------------------------------------------------------------------
-- Le fondateur (hors aperçu) inscrit le stagiaire et efface ses traces. Rejouable : un second appel garde la date.
create function public.autonomie_opposer(p_stagiaire integer)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $f$
begin
  if not est_fondateur() then
    raise exception 'autonomie: Réservé au fondateur.';
  end if;
  if p_stagiaire is null or not exists (select 1 from stagiaires where id = p_stagiaire) then
    raise exception 'autonomie: Fiche introuvable.';
  end if;
  insert into autonomie_oppositions (stagiaire_id) values (p_stagiaire) on conflict (stagiaire_id) do nothing;
  perform pg_advisory_xact_lock(hashtext('autonomie_temps'), p_stagiaire);
  delete from cours_lectures where stagiaire_id = p_stagiaire;
  delete from autonomie_temps where stagiaire_id = p_stagiaire;
end $f$;

revoke all on function public.autonomie_tracer_cours(uuid, integer, boolean, text), public.autonomie_tracer_qcm(bigint, integer),
  public.autonomie_lectures_promo(), public.autonomie_opposer(integer) from public, anon, authenticated, service_role;
grant execute on function public.autonomie_tracer_cours(uuid, integer, boolean, text), public.autonomie_tracer_qcm(bigint, integer),
  public.autonomie_lectures_promo(), public.autonomie_opposer(integer) to authenticated;
