-- Retour de 20261110_conservation.sql (conservation à 3 ans, lot Q5), partie fiches et émargement.
-- Procédure : retirer d'abord de l'app le commit qui appelle les nouvelles fonctions (etat_conservation,
-- effacer_promo_etape1, effacer_promo_etape2, effacer_sur_demande) et remettre en ligne la version d'avant, PUIS jouer
-- ce fichier (psql -1, PGCLIENTENCODING=UTF8). À jouer avant tout retour du lot Q3 (questionnaires), dont ce lot lit
-- _questionnaire_jour() et peut_gerer_qualite().
-- Réversible seulement AVANT toute étape : un effacement ne se défait pas. Le retour commence donc par refuser (exception,
-- rien n'est touché) dès qu'une étape de ce lot a laissé une trace : une ligne de type etape1, etape2, demande,
-- questionnaires ou registre au journal des effacements, une fiche marquée par une étape (efface_le posé sans
-- anonymise_le, ou différent de anonymise_le), une signature effacée. Sinon il recrée à l'identique les quatre fonctions
-- d'anonymisation (version du lot 4, droits du 05/10), emargement_signer (version du lot 4), emargement_annoter et
-- emargement_clore (versions du 23/10), et les contraintes d'origine, puis retire les marques (et leur déclencheur) et
-- les fonctions de ce lot. Questionnaires (tâche 3) : refus aussi dès qu'un résultat est figé (seule copie des
-- pourcentages) ou qu'une année des formateurs est close ; sinon les cinq fonctions réécrites du lot Q3 reviennent
-- telles quelles, les tables et fonctions de ce lot partent, et les participations reprennent leur forme du lot Q3
-- (sans fiche, liées au compte en cascade) : une participation dont le compte a été supprimé depuis ce lot part, comme
-- elle serait partie avec le compte avant ce lot ; un doublon de fiche fusionné par la migration ne revient pas (aucun
-- le 10/11).
set local lock_timeout = '3s';

do $garde$
begin
  if exists (select 1 from public.questionnaire_resultats_figes) then
    raise exception 'conservation: Retour impossible : des résultats de questionnaires sont figés (seule copie des pourcentages).';
  end if;
  if exists (select 1 from public.questionnaire_clotures) then
    raise exception 'conservation: Retour impossible : une année du questionnaire des formateurs est close.';
  end if;
  if exists (select 1 from public.effacements_journal
              where type in ('etape1', 'etape2', 'demande', 'questionnaires', 'registre')) then
    raise exception 'conservation: Retour impossible : une étape de conservation a déjà effacé des données (journal des effacements).';
  end if;
  if exists (select 1 from public.stagiaires
              where efface_le is not null and (anonymise_le is null or efface_le <> anonymise_le)) then
    raise exception 'conservation: Retour impossible : une fiche porte la marque d''une étape de conservation.';
  end if;
  if exists (select 1 from public.emargement_lignes where signature_effacee_le is not null)
     or exists (select 1 from public.emargement_formateurs where signature_effacee_le is not null) then
    raise exception 'conservation: Retour impossible : une signature d''émargement a déjà été effacée.';
  end if;
end
$garde$;

-- 0 bis. Registre qualité (tâche 4) : effacer_registre_qualite() telle que le lot Q4 l'a créée (sans journal). Create or
-- replace : droits gardés.
create or replace function public.effacer_registre_qualite()
returns integer
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  n integer;
begin
  if not peut_gerer_qualite() then
    raise exception 'registre: Tu n''as pas accès au registre qualité.';
  end if;
  update registre_qualite
     set description = null, reponse = null, action_decidee = null, mesure_prevention = null, efface_le = now()
   where etat = 'clos' and efface_le is null and clos_le + interval '3 years' < now();
  get diagnostics n = row_count;
  return n;
end;
$function$;

-- 0. Questionnaires (tâche 3) : fonctions du lot Q3 telles qu'elles étaient (create or replace : droits d'exécution
-- gardés), puis fonctions et tables de ce lot retirées, participations à leur forme du lot Q3.
create or replace function public._questionnaire_ouvert(p_cle text, p_promo integer, p_lieu integer, p_annee integer)
returns boolean language sql stable set search_path to 'public', 'pg_temp' as $function$
  select coalesce(
    (select o.ouvert from questionnaire_ouvertures o
      where o.cle = p_cle and o.promo_id is not distinct from p_promo
        and o.lieu_id is not distinct from p_lieu and o.annee is not distinct from p_annee),
    case when p_cle in ('fin_stagiaire', 'six_mois_stagiaire') then exists (
           select 1 from promos pr, _questionnaire_fenetre(p_cle, pr.date_fin) f
            where pr.id = p_promo and d.jour between f.du and f.au)
         when p_cle = 'fin_formateur' then p_annee = extract(year from d.jour)::integer and exists (
           select 1 from promos pr, _questionnaire_fenetre(p_cle, pr.date_fin) f
            where pr.lieu_id = p_lieu and d.jour between f.du and f.au)
         else false end)
  from (select _questionnaire_jour() as jour) d;
$function$;

create or replace function public.questionnaires_a_remplir()
returns table (cle text, version integer, portee jsonb)
language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  with moi as (
    select up.stagiaire_id from user_profiles up
     where lower(up.email) = lower((select auth.jwt() ->> 'email'))
     limit 1
  ),
  candidats as (
    select k.cle, s.promo_id, null::integer as lieu_id, null::integer as annee
      from moi join stagiaires s on s.id = moi.stagiaire_id
     cross join (values ('fin_stagiaire'), ('six_mois_stagiaire')) k(cle)
    union
    select 'fin_formateur', null, l.id, extract(year from _questionnaire_jour())::integer from lieux l
    union
    select o.cle, null, o.lieu_id, o.annee from questionnaire_ouvertures o where o.cle = 'fin_formateur' and o.ouvert
  )
  select c.cle, _questionnaire_version(c.cle),
         case when c.promo_id is not null then jsonb_build_object('promo_id', c.promo_id)
              else jsonb_build_object('lieu_id', c.lieu_id, 'annee', c.annee) end
    from candidats c
   where auth.uid() is not null
     and _questionnaire_ayant_droit(c.cle, c.promo_id, c.lieu_id)
     and _questionnaire_ouvert(c.cle, c.promo_id, c.lieu_id, c.annee)
     and not exists (
       select 1 from questionnaire_participations p
        where p.cle = c.cle and p.promo_id is not distinct from c.promo_id
          and p.lieu_id is not distinct from c.lieu_id and p.annee is not distinct from c.annee
          and p.user_id = auth.uid())
   order by 1, 3;
$function$;

create or replace function public.repondre_questionnaire(p_cle text, p_portee jsonb, p_version integer, p_reponses jsonb,
  p_commentaire text default null)
returns void
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(auth.jwt() ->> 'email');
  v_version integer := _questionnaire_version(p_cle);
  v_portee record;
  v_commentaire text := nullif(btrim(coalesce(p_commentaire, ''), E' \t\r\n'), '');
  v_question text;
  v_valeur jsonb;
  q questionnaire_questions%rowtype;
  v_id uuid;
  n integer;
begin
  if v_uid is null or v_email is null then
    raise exception 'questionnaire: Reconnecte-toi pour répondre.';
  end if;
  if v_version is null then
    raise exception 'questionnaire: Questionnaire inconnu.';
  end if;
  if p_version is distinct from v_version then
    raise exception 'questionnaire: Le questionnaire a changé : recharge la page.';
  end if;
  select * into v_portee from _questionnaire_portee(p_cle, p_portee);
  if not _questionnaire_ayant_droit(p_cle, v_portee.promo_id, v_portee.lieu_id) then
    raise exception 'questionnaire: Ce questionnaire ne te concerne pas.';
  end if;
  -- Une portée à la fois (voir l'en-tête) : un envoi simultané dans la même portée attend la fin de celui-ci ; les
  -- instructions suivantes, chacune avec un instantané neuf, voient alors ses lignes validées.
  perform pg_advisory_xact_lock(hashtext('questionnaire:' || p_cle || ':'
    || coalesce(v_portee.promo_id::text, v_portee.lieu_id::text || '/' || v_portee.annee::text)));
  if not _questionnaire_ouvert(p_cle, v_portee.promo_id, v_portee.lieu_id, v_portee.annee) then
    raise exception 'questionnaire: Ce questionnaire est fermé.';
  end if;
  if exists (select 1 from questionnaire_participations p
              where p.cle = p_cle and p.promo_id is not distinct from v_portee.promo_id
                and p.lieu_id is not distinct from v_portee.lieu_id and p.annee is not distinct from v_portee.annee
                and p.user_id = v_uid) then
    raise exception 'questionnaire: Tu as déjà répondu à ce questionnaire.';
  end if;

  -- Forme : un objet { question: valeur } ; questions connues de cette version ; échelle 1 à 4 ou null (« sans
  -- avis ») ; choix parmi les options ; toutes les questions non facultatives présentes.
  if p_reponses is null or jsonb_typeof(p_reponses) <> 'object' then
    raise exception 'questionnaire: Réponses illisibles.';
  end if;
  for v_question, v_valeur in select e.key, e.value from jsonb_each(p_reponses) e loop
    select * into q from questionnaire_questions
     where cle = p_cle and version = v_version and question_id = v_question;
    if not found then
      raise exception 'questionnaire: Question inconnue.';
    end if;
    if q.type = 'echelle' and not (jsonb_typeof(v_valeur) = 'null'
        or (jsonb_typeof(v_valeur) = 'number' and v_valeur::text in ('1', '2', '3', '4'))) then
      raise exception 'questionnaire: Réponse hors de l''échelle.';
    end if;
    if q.type = 'choix' and not (jsonb_typeof(v_valeur) = 'string' and (v_valeur #>> '{}') = any (q.options)) then
      raise exception 'questionnaire: Choix inconnu.';
    end if;
  end loop;
  if exists (select 1 from questionnaire_questions
              where cle = p_cle and version = v_version and not facultative and not (p_reponses ? question_id)) then
    raise exception 'questionnaire: Il manque des réponses.';
  end if;
  if char_length(coalesce(v_commentaire, '')) > 2000 then
    raise exception 'questionnaire: Ton commentaire dépasse 2 000 caractères.';
  end if;

  -- Deux envois simultanés : la contrainte d'unicité tranche, le second est refusé et n'écrit rien.
  insert into questionnaire_participations (cle, promo_id, lieu_id, annee, user_id)
  values (p_cle, v_portee.promo_id, v_portee.lieu_id, v_portee.annee, v_uid)
  on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'questionnaire: Tu as déjà répondu à ce questionnaire.';
  end if;
  insert into questionnaire_reponses (cle, version, promo_id, lieu_id, annee, reponses, commentaire)
  values (p_cle, v_version, v_portee.promo_id, v_portee.lieu_id, v_portee.annee, p_reponses, v_commentaire);

  -- Brassage (voir l'en-tête) : toutes les réponses de la portée sont réécrites, dans un ordre tiré au hasard et avec
  -- un nouvel identifiant ; commentaire et réponses recopiés pour que leurs morceaux TOAST soient réécrits aussi.
  for v_id in
    select r.id from questionnaire_reponses r
     where r.cle = p_cle and r.promo_id is not distinct from v_portee.promo_id
       and r.lieu_id is not distinct from v_portee.lieu_id and r.annee is not distinct from v_portee.annee
     order by random()
  loop
    update questionnaire_reponses
       set id = gen_random_uuid(), commentaire = commentaire || '', reponses = reponses || '{}'::jsonb
     where id = v_id;
  end loop;
end;
$function$;

create or replace function public.resultats_questionnaire(p_cle text, p_portee jsonb)
returns jsonb
language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_portee record;
  v_seuil integer := _questionnaire_seuil(p_cle);
  n integer;
  v_questions jsonb;
begin
  if not peut_gerer_qualite() then
    raise exception 'questionnaire: Réservé à la gestion de la qualité.';
  end if;
  if _questionnaire_version(p_cle) is null then
    raise exception 'questionnaire: Questionnaire inconnu.';
  end if;
  select * into v_portee from _questionnaire_portee(p_cle, p_portee);

  select count(*) into n from questionnaire_reponses r
   where r.cle = p_cle and r.promo_id is not distinct from v_portee.promo_id
     and r.lieu_id is not distinct from v_portee.lieu_id and r.annee is not distinct from v_portee.annee;

  with paires as (
    select e.key as question,
           case jsonb_typeof(e.value) when 'null' then 'sans_avis'
                                       when 'string' then e.value #>> '{}'
                                       else e.value::text end as valeur
      from questionnaire_reponses r, jsonb_each(r.reponses) e
     where r.cle = p_cle and r.promo_id is not distinct from v_portee.promo_id
       and r.lieu_id is not distinct from v_portee.lieu_id and r.annee is not distinct from v_portee.annee
  ),
  publiables as (
    select question from paires group by question having count(*) >= v_seuil
  ),
  comptes as (
    select question, jsonb_object_agg(valeur, nombre) as repartition
      from (select question, valeur, count(*) as nombre from paires
             where question in (select question from publiables) group by question, valeur) c
     group by question
  )
  select coalesce(jsonb_object_agg(question, repartition), '{}'::jsonb) into v_questions from comptes;

  return jsonb_build_object(
    'cle', p_cle,
    'public', _questionnaire_public(p_cle),
    'seuil', v_seuil,
    'reponses', case when n >= v_seuil then n end,
    'questions', case when n >= v_seuil then v_questions else '{}'::jsonb end);
end;
$function$;

create or replace function public.ouvrir_questionnaire(p_cle text, p_portee jsonb, p_ouvert boolean)
returns void
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_portee record;
begin
  if not peut_gerer_qualite() then
    raise exception 'questionnaire: Réservé à la gestion de la qualité.';
  end if;
  if _questionnaire_version(p_cle) is null then
    raise exception 'questionnaire: Questionnaire inconnu.';
  end if;
  select * into v_portee from _questionnaire_portee(p_cle, p_portee);
  if v_portee.promo_id is not null and not exists (select 1 from promos where id = v_portee.promo_id) then
    raise exception 'questionnaire: Promo introuvable.';
  end if;
  if v_portee.lieu_id is not null and not exists (select 1 from lieux where id = v_portee.lieu_id) then
    raise exception 'questionnaire: Lieu introuvable.';
  end if;
  delete from questionnaire_ouvertures o
   where o.cle = p_cle and o.promo_id is not distinct from v_portee.promo_id
     and o.lieu_id is not distinct from v_portee.lieu_id and o.annee is not distinct from v_portee.annee;
  if p_ouvert is not null then
    insert into questionnaire_ouvertures (cle, promo_id, lieu_id, annee, ouvert, par_email)
    values (p_cle, v_portee.promo_id, v_portee.lieu_id, v_portee.annee, p_ouvert, lower(auth.jwt() ->> 'email'));
  end if;
end;
$function$;

drop function public.figer_questionnaire_formateurs(integer, integer);
drop function public.effacer_commentaires_formateurs(integer, integer);
drop function public.clore_annee_formateurs(integer, integer);
drop function public._questionnaire_figer(text, integer, integer, integer);
drop function public._questionnaire_clore(integer, integer);
drop function public._questionnaire_effacer_commentaires(text, integer, integer, integer);
drop function public._questionnaire_clos(text, integer, integer, integer);
drop function public._questionnaire_comptes(text, integer, integer, integer);
drop function public._questionnaire_rebrasser(text, integer, integer, integer);
drop table public.questionnaire_clotures;
drop table public.questionnaire_resultats_figes;
-- Une participation sans compte (compte supprimé depuis ce lot) serait partie avec lui avant ce lot (cascade).
delete from public.questionnaire_participations where user_id is null;
drop index public.questionnaire_participations_compte_unique;
alter table public.questionnaire_participations
  drop constraint questionnaire_participations_fiche_unique,
  drop constraint questionnaire_participations_fiche,
  drop constraint questionnaire_participations_user_id_fkey,
  drop column stagiaire_id,
  alter column user_id set not null,
  add constraint questionnaire_participations_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  add constraint questionnaire_participations_unique unique nulls not distinct (cle, promo_id, lieu_id, annee, user_id);

-- 1. Fonctions de ce lot ---------------------------------------------------------------------------------------------
drop function public.effacer_sur_demande(integer);
drop function public.fiches_effacees_sur_demande(integer[]);
drop function public.effacer_promo_etape2(integer);
drop function public.effacer_promo_etape1(integer);
drop function public.etat_conservation();
drop function public._effacer_etape2(integer);
drop function public._effacer_etape1(integer);

-- 2. Émargement : versions d'avant (create or replace : droits d'exécution gardés) ------------------------------------
CREATE OR REPLACE FUNCTION public.emargement_signer(p_seance bigint, p_stagiaire integer, p_trace text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  s emargement_seances := emargement_feuille(p_seance, false);
  v_appareil boolean;
  v_quand timestamptz;
begin
  if s.statut <> 'ouverte' then
    raise exception 'emargement: La feuille est close.';
  end if;
  if s.jour <> emargement_jour_paris() then
    raise exception 'emargement: Une feuille ne se signe que le jour même.';
  end if;
  if p_stagiaire is not null and p_stagiaire = my_stagiaire_id() then
    v_appareil := false;
  elsif formateur_courant() then
    v_appareil := true;
  else
    raise exception 'emargement: Tu ne peux signer que pour toi.';
  end if;
  if not exists (select 1 from stagiaires where id = p_stagiaire and promo_id = s.promo_id and actif) then
    raise exception 'emargement: Stagiaire introuvable dans cette promo.';
  end if;
  if not emargement_trace_valide(p_trace) then
    raise exception 'emargement: Signature illisible, recommence.';
  end if;
  if exists (select 1 from emargement_lignes where seance_id = s.id and stagiaire_id = p_stagiaire and absent) then
    raise exception 'emargement: Noté absent : un formateur doit d''abord retirer l''absence.';
  end if;
  insert into emargement_lignes (seance_id, promo_id, stagiaire_id, trace, signe_le, signe_par,
                                 sur_appareil_formateur, maj_par)
  values (s.id, s.promo_id, p_stagiaire, p_trace, now(), v_email, v_appareil, v_email)
  on conflict (seance_id, stagiaire_id) do update
    set trace = excluded.trace, signe_le = excluded.signe_le, signe_par = excluded.signe_par,
        sur_appareil_formateur = excluded.sur_appareil_formateur, maj_le = now(), maj_par = excluded.maj_par
    where emargement_lignes.trace is null and not emargement_lignes.absent
  returning signe_le into v_quand;
  if v_quand is null then
    raise exception 'emargement: Déjà signé.';
  end if;
  return v_quand;
end;
$function$;

CREATE OR REPLACE FUNCTION public.emargement_annoter(p_seance bigint, p_stagiaire integer, p_absent boolean, p_observation text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  s emargement_seances := emargement_feuille(p_seance, true);
  l emargement_lignes;
  v_obs text := nullif(btrim(p_observation), '');
begin
  if not exists (select 1 from stagiaires where id = p_stagiaire and promo_id = s.promo_id) then
    raise exception 'emargement: Stagiaire introuvable dans cette promo.';
  end if;
  if length(v_obs) > 200 then
    raise exception 'emargement: Observation trop longue (200 caractères au plus).';
  end if;
  select * into l from emargement_lignes where seance_id = s.id and stagiaire_id = p_stagiaire for update;
  if p_absent is not null then
    if s.statut <> 'ouverte' then
      raise exception 'emargement: La feuille est close : rouvre-la pour changer une absence.';
    end if;
    if p_absent and l.trace is not null then
      raise exception 'emargement: Déjà signé : ajoute plutôt une observation.';
    end if;
  end if;
  if l.id is null then
    if p_absent is not true and v_obs is null then
      return;  -- rien à noter
    end if;
    insert into emargement_lignes (seance_id, promo_id, stagiaire_id, absent, absence_origine, observation, maj_par)
    values (s.id, s.promo_id, p_stagiaire, coalesce(p_absent, false),
            case when p_absent then 'formateur' end, v_obs, v_email);
    return;
  end if;
  update emargement_lignes
     set absent = coalesce(p_absent, absent),
         absence_origine = case when p_absent is null then absence_origine
                                when p_absent then 'formateur' end,
         observation = case when p_observation is null then observation else v_obs end,
         maj_le = now(), maj_par = v_email
   where id = l.id;
  delete from emargement_lignes
   where id = l.id and trace is null and not absent and observation is null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.emargement_clore(p_seance bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  s emargement_seances := emargement_feuille(p_seance, true);
  v_jour_index integer;
  v_n integer;
begin
  if s.statut <> 'ouverte' then
    raise exception 'emargement: Cette feuille est déjà close.';
  end if;
  if not exists (select 1 from emargement_formateurs where seance_id = s.id) then
    raise exception 'emargement: Il manque la signature du formateur.';
  end if;
  v_jour_index := extract(isodow from s.jour)::integer - 1;
  with planning as (
    select distinct case when (a ->> 'sid') ~ '^[0-9]{1,9}$' then (a ->> 'sid')::integer end as sid
      from planning_entries pe
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(pe.absences) = 'array' then pe.absences else '[]'::jsonb end) a
     where pe.promo_id = s.promo_id
       and pe.semaine_lundi = s.jour - v_jour_index
       and pe.day_index = v_jour_index
       and pe.half_day = s.demi_journee
  ), absents as (
    insert into emargement_lignes (seance_id, promo_id, stagiaire_id, absent, absence_origine, maj_par)
    select s.id, s.promo_id, st.id, true,
           case when st.id in (select sid from planning where sid is not null) then 'planning' else 'non_signe' end,
           v_email
      from stagiaires st
     where st.promo_id = s.promo_id and st.actif
    on conflict (seance_id, stagiaire_id) do update
      set absent = true, absence_origine = excluded.absence_origine, maj_le = now(), maj_par = excluded.maj_par
      where emargement_lignes.trace is null and not emargement_lignes.absent
    returning 1
  )
  select count(*) into v_n from absents;
  update emargement_seances set statut = 'close', close_le = now(), close_par = v_email where id = s.id;
  return v_n;
end;
$function$;

-- 3. Les quatre fonctions d'anonymisation, version du lot 4, droits du 05/10 ------------------------------------------
CREATE OR REPLACE FUNCTION public._anonymiser_stagiaire(p_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  s record;
  v_emails text[];
  v_noms text[];          -- formes sous lesquelles la personne apparaît dans les champs « qui »
  v_remplace constant text := 'Stagiaire anonyme';
  v_n jsonb := '{}'::jsonb;
  n integer;
  x text;
begin
  select * into s from stagiaires where id = p_id for update;
  if not found then raise exception 'Stagiaire introuvable'; end if;
  if s.anonymise_le is not null then return jsonb_build_object('deja', true); end if;

  if exists (select 1 from user_profiles u where u.stagiaire_id = p_id
                and (u.is_admin or u.is_founder or exists (select 1 from affectations a where lower(a.email) = lower(u.email)))) then
    raise exception 'Compte administrateur : anonymisation refusée (retirer d''abord le droit admin)';
  end if;

  select coalesce(array_agg(distinct lower(email)), '{}') into v_emails
    from user_profiles where stagiaire_id = p_id;
  -- Nom affiché dans l'app (« V. Timy », cf. displayStagiaire) et e-mails (repli de getProfileWho).
  v_noms := array[case when coalesce(trim(s.nom), '') <> ''
                       then upper(left(trim(s.nom), 1)) || '. ' || s.prenom else s.prenom end]
            || v_emails;

  -- Documents et données privées : supprimés.
  delete from stagiaires_prive where stagiaire_id = p_id; get diagnostics n = row_count; v_n := v_n || jsonb_build_object('date_naissance', n);
  delete from dp_dossiers where stagiaire_id = p_id;      get diagnostics n = row_count; v_n := v_n || jsonb_build_object('dossier_pro', n);
  delete from epcf_livrets where stagiaire_id = p_id;     get diagnostics n = row_count; v_n := v_n || jsonb_build_object('livret', n);
  delete from fiches_suivi where stagiaire_id = p_id;     get diagnostics n = row_count; v_n := v_n || jsonb_build_object('fiche_suivi', n);

  -- Résultats conservés, textes libres vidés (ils peuvent contenir un prénom, une santé…).
  -- (epcf_evaluations.contexte n'est pas un texte libre : c'est un code, « EPCF ».)
  update epcf_evaluations set commentaire = null where stagiaire_id = p_id and commentaire is not null;
  get diagnostics n = row_count; v_n := v_n || jsonb_build_object('epcf_textes', n);
  update evaluations set observation = null where stagiaire_id = p_id and observation is not null;
  get diagnostics n = row_count; v_n := v_n || jsonb_build_object('observations', n);
  update passages set commentaire = null where stagiaire_id = p_id and commentaire is not null;
  get diagnostics n = row_count; v_n := v_n || jsonb_build_object('commentaires_passages', n);

  -- E-mails de la personne, partout où ils servent de signature.
  if cardinality(v_emails) > 0 then
    update evaluations set created_by_email = 'anonyme' where lower(created_by_email) = any(v_emails);
    update evaluations set updated_by_email = 'anonyme' where lower(updated_by_email) = any(v_emails);
    update evaluations_audit set changed_by_email = 'anonyme' where lower(changed_by_email) = any(v_emails);
    update agenda_events set created_by_email = 'anonyme' where lower(created_by_email) = any(v_emails);
    update qcm_signalements set email = 'anonyme' where lower(email) = any(v_emails);
    update themes set updated_by_email = 'anonyme' where lower(updated_by_email) = any(v_emails);
    update themes_progression set updated_by_email = 'anonyme' where lower(updated_by_email) = any(v_emails);
    update user_profiles set invited_by_email = 'anonyme' where lower(invited_by_email) = any(v_emails);
    delete from conditions_acceptations where lower(email) = any(v_emails);
  end if;

  -- Champs « qui a fait la modification » (nom affiché ou e-mail).
  update passages set created_by_who = v_remplace where created_by_who = any(v_noms);
  update passages set updated_by_who = v_remplace where updated_by_who = any(v_noms);
  update passages_audit set changed_by_who = v_remplace where changed_by_who = any(v_noms);
  update epcf_evaluations set updated_by_who = v_remplace where updated_by_who = any(v_noms);
  update planning_jours_off set created_by_who = v_remplace where created_by_who = any(v_noms);

  -- Historiques : les mêmes valeurs dans les instantanés JSON (valeurs exactes entre guillemets).
  foreach x in array v_noms loop
    update passages_audit
       set before_data = replace(before_data::text, to_jsonb(x)::text, to_jsonb(v_remplace)::text)::jsonb,
           after_data  = replace(after_data::text,  to_jsonb(x)::text, to_jsonb(v_remplace)::text)::jsonb
     where before_data::text like '%' || to_jsonb(x)::text || '%'
        or after_data::text  like '%' || to_jsonb(x)::text || '%';
    update evaluations_audit
       set before_data = replace(before_data::text, to_jsonb(x)::text, to_jsonb('anonyme'::text)::text)::jsonb,
           after_data  = replace(after_data::text,  to_jsonb(x)::text, to_jsonb('anonyme'::text)::text)::jsonb
     where before_data::text like '%' || to_jsonb(x)::text || '%'
        or after_data::text  like '%' || to_jsonb(x)::text || '%';
  end loop;

  -- Les historiques gardent une copie des lignes : on y vide aussi les textes libres.
  update evaluations_audit
     set before_data = case when before_data ? 'observation' then jsonb_set(before_data, '{observation}', 'null') else before_data end,
         after_data  = case when after_data  ? 'observation' then jsonb_set(after_data,  '{observation}', 'null') else after_data end
   where (before_data ->> 'stagiaire_id')::int = p_id or (after_data ->> 'stagiaire_id')::int = p_id;
  update passages_audit
     set before_data = case when before_data ? 'commentaire' then jsonb_set(before_data, '{commentaire}', 'null') else before_data end,
         after_data  = case when after_data  ? 'commentaire' then jsonb_set(after_data,  '{commentaire}', 'null') else after_data end
   where (before_data ->> 'stagiaire_id')::int = p_id or (after_data ->> 'stagiaire_id')::int = p_id;

  -- Compte : profil puis compte de connexion (sessions, compteur de l'assistant en cascade).
  delete from user_profiles where stagiaire_id = p_id; get diagnostics n = row_count; v_n := v_n || jsonb_build_object('profils', n);
  if cardinality(v_emails) > 0 then
    delete from auth.users where lower(email) = any(v_emails); get diagnostics n = row_count;
    v_n := v_n || jsonb_build_object('comptes', n);
  end if;

  update stagiaires
     set prenom = 'Anonyme ' || p_id, nom = null, actif = false, date_naissance = null, anonymise_le = now()
   where id = p_id;

  return v_n;
end;
$function$;
revoke all on function public._anonymiser_stagiaire(integer) from anon, public, authenticated;
-- La table fiches_suivi et la colonne themes.updated_by_email peuvent avoir été retirées (branche navigation-unique) :
-- dans ce cas seulement, les deux écritures qui les citent deviennent des requêtes dynamiques conditionnées (create or
-- replace : droits gardés). Quand les deux existent, la fonction reste mot pour mot celle d'avant le lot.
do $retour_objets$
declare
  v_def text := pg_get_functiondef('public._anonymiser_stagiaire(integer)'::regprocedure);
  v_suivi constant text := 'delete from fiches_suivi where stagiaire_id = p_id;     get diagnostics n = row_count; v_n := v_n || jsonb_build_object(''fiche_suivi'', n);';
  v_themes constant text := 'update themes set updated_by_email = ''anonyme'' where lower(updated_by_email) = any(v_emails);';
  v_sans_suivi boolean := to_regclass('public.fiches_suivi') is null;
  v_sans_themes boolean := not exists (select 1 from pg_attribute where attrelid = to_regclass('public.themes')
                                         and attname = 'updated_by_email' and attnum > 0 and not attisdropped);
begin
  if not (v_sans_suivi or v_sans_themes) then
    return;
  end if;
  if position(v_suivi in v_def) = 0 or position(v_themes in v_def) = 0 then
    raise exception 'conservation: Retour : _anonymiser_stagiaire recréée ne contient pas les écritures attendues.';
  end if;
  v_def := replace(v_def, v_suivi,
    'n := 0; if to_regclass(''public.fiches_suivi'') is not null then execute ''delete from public.fiches_suivi where stagiaire_id = $1'' using p_id; get diagnostics n = row_count; end if; v_n := v_n || jsonb_build_object(''fiche_suivi'', n);');
  v_def := replace(v_def, v_themes,
    'if exists (select 1 from pg_attribute where attrelid = to_regclass(''public.themes'') and attname = ''updated_by_email'' and attnum > 0 and not attisdropped) then execute ''update public.themes set updated_by_email = ''''anonyme'''' where lower(updated_by_email) = any($1)'' using v_emails; end if;');
  execute v_def;
end
$retour_objets$;

CREATE OR REPLACE FUNCTION public.anonymiser_promo()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  p record;
  s record;
  v_faits integer := 0;
  v_ignores integer := 0;
begin
  if not equipe_courante() then raise exception 'Réservé aux administrateurs'; end if;
  select * into p from promos where id = promo_courante();
  if not found then raise exception 'Aucune promo affichée'; end if;
  if p.date_fin is null then raise exception 'Date de fin de promo non renseignée'; end if;
  if current_date < (p.date_fin + interval '12 months')::date then
    raise exception 'Anonymisation possible à partir du %', to_char((p.date_fin + interval '12 months')::date, 'DD/MM/YYYY');
  end if;
  for s in select id from stagiaires where promo_id = p.id and anonymise_le is null order by id loop
    if exists (select 1 from user_profiles u where u.stagiaire_id = s.id
                  and (u.is_admin or u.is_founder or exists (select 1 from affectations a where lower(a.email) = lower(u.email)))) then
      v_ignores := v_ignores + 1;
      continue;
    end if;
    perform _anonymiser_stagiaire(s.id);
    v_faits := v_faits + 1;
  end loop;
  insert into effacements_journal (type, cible, fait_par_email, details)
  values ('promo', 'promo ' || p.id, lower(auth.jwt() ->> 'email'),
          jsonb_build_object('anonymises', v_faits, 'comptes_admin_ignores', v_ignores));
  return jsonb_build_object('anonymises', v_faits, 'comptes_admin_ignores', v_ignores);
end;
$function$;
revoke all on function public.anonymiser_promo() from anon, public;
grant execute on function public.anonymiser_promo() to authenticated;

CREATE OR REPLACE FUNCTION public.anonymiser_stagiaire(p_stagiaire_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v jsonb;
begin
  if not equipe_courante() then raise exception 'Réservé aux administrateurs'; end if;
  if not exists (select 1 from stagiaires where id = p_stagiaire_id and promo_id = promo_courante()) then
    raise exception 'Ce stagiaire n''appartient pas à la promo affichée';
  end if;
  if exists (select 1 from stagiaires where id = p_stagiaire_id and actif) then
    raise exception 'Marquez d''abord ce stagiaire en abandon';
  end if;
  v := _anonymiser_stagiaire(p_stagiaire_id);
  if not coalesce((v ->> 'deja')::boolean, false) then
    insert into effacements_journal (type, cible, fait_par_email, details)
    values ('stagiaire', 'stagiaire ' || p_stagiaire_id, lower(auth.jwt() ->> 'email'), v);
  end if;
  return v;
end;
$function$;
revoke all on function public.anonymiser_stagiaire(integer) from anon, public;
grant execute on function public.anonymiser_stagiaire(integer) to authenticated;

CREATE OR REPLACE FUNCTION public.etat_anonymisation_promo()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  p record;
begin
  if not equipe_courante() then raise exception 'Réservé aux administrateurs'; end if;
  select * into p from promos where id = promo_courante();
  if not found then return null; end if;
  return jsonb_build_object(
    'promo_id', p.id,
    'nom', p.nom,
    'date_fin', p.date_fin,
    'anonymisable_le', case when p.date_fin is null then null else (p.date_fin + interval '12 months')::date end,
    'anonymisable', p.date_fin is not null and current_date >= (p.date_fin + interval '12 months')::date,
    'restants', (select count(*) from stagiaires where promo_id = p.id and anonymise_le is null),
    'comptes_admin', (select count(*) from stagiaires s where s.promo_id = p.id and s.anonymise_le is null
                        and exists (select 1 from user_profiles u where u.stagiaire_id = s.id
                                       and (u.is_admin or u.is_founder or exists (select 1 from affectations a where lower(a.email) = lower(u.email))))),
    'anonymises', (select count(*) from stagiaires where promo_id = p.id and anonymise_le is not null)
  );
end;
$function$;
revoke all on function public.etat_anonymisation_promo() from anon, public;
grant execute on function public.etat_anonymisation_promo() to authenticated;

-- 4. Contraintes et marques d'origine ----------------------------------------------------------------------------------
alter table public.effacements_journal drop constraint effacements_journal_type_check;
alter table public.effacements_journal add constraint effacements_journal_type_check
  check (type in ('stagiaire', 'promo', 'benevoles'));

alter table public.emargement_formateurs drop constraint emargement_formateurs_signature;
alter table public.emargement_formateurs drop column signature_effacee_le;
alter table public.emargement_formateurs alter column trace set not null;
alter table public.emargement_lignes drop constraint emargement_lignes_signature;
alter table public.emargement_lignes drop column signature_effacee_le;
alter table public.emargement_lignes
  add constraint emargement_lignes_check check ((trace is null) = (signe_le is null) and (trace is null) = (signe_par is null));

drop trigger stagiaires_marques_conservation on public.stagiaires;
drop function public._stagiaires_marques_conservation();
alter table public.stagiaires drop constraint stagiaires_efface_avant_anonyme;
alter table public.stagiaires drop column efface_le;
