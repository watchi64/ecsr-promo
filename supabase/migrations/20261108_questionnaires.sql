-- Questionnaires anonymes (Qualiopi, indicateur 30), lot Q3 du chantier du 2026-11-08.
-- Spec : docs/superpowers/specs/2026-11-08-qualiopi-q3-q5-design.md (§ 4, § 10, § 11). Règles pures reprises ici :
-- js/questionnaires-rules.js et js/questionnaires-data.js. Retour : 20261108_questionnaires_retour.sql.
-- Preuve : tests/sql/questionnaires-preuve.sql.
-- NON APPLIQUÉE : à appliquer seulement avec l'accord de Timy, après sa validation du texte des questions et des
-- conditions d'utilisation.
--
-- Trois questionnaires : fin_stagiaire et six_mois_stagiaire (portée : la promo), fin_formateur (portée : le lieu et
-- l'année civile du jour, § 11). Ouverts selon la date de fin de la promo (de J-7 à J+30 ; de +6 mois à +7 mois), ou à la
-- main par la gestion, l'ouverture manuelle primant dans les deux sens. Seuil d'affichage : 5 réponses pour les
-- stagiaires, 3 pour les formateurs (§ 11), question par question.
--
-- Anonymat par construction (§ 4.3 et § 10) :
--  - questionnaire_reponses n'a ni utilisateur, ni date, ni numéro : un identifiant tiré au hasard, le questionnaire,
--    sa version, la portée, les réponses et le commentaire. Aucune règle de lecture, aucun droit pour les rôles de
--    l'API (service_role compris) : les résultats sortent par une fonction qui ne rend que des comptes, rien sous le
--    seuil ; les commentaires par une autre, au fondateur seul, dans un ordre tiré au hasard.
--  - questionnaire_participations garde (questionnaire, portée, utilisateur), sans date : elle éteint le bandeau et
--    refuse un deuxième envoi. Elle n'a aucune colonne commune avec les réponses hors de la portée.
--  - Postgres marque chaque ligne du numéro de la transaction qui l'a écrite (colonne système xmin) : la réponse et la
--    participation écrites ensemble porteraient le même, et l'ordre de ces numéros (comme l'ordre physique des lignes)
--    suivrait l'ordre d'arrivée. Chaque nouvelle réponse réécrit donc toutes les réponses de sa portée, une à une dans
--    un ordre tiré au hasard et avec un nouvel identifiant : elles partagent alors toutes le numéro de la dernière
--    transaction, et leur rang physique ne dit plus rien de leur arrivée.
--  - Reste hors de portée de la base : les sauvegardes et le journal des transactions gardent l'historique ; les
--    anciennes versions des lignes restent lisibles par un superutilisateur (extension pageinspect) jusqu'au passage du
--    nettoyage automatique ; et quelqu'un qui relèverait les résultats après chaque réponse en déduirait la dernière
--    par différence (le seuil limite ce risque sans l'annuler).
--
-- Écart à la spec (décision R1 du contrôleur, 08/11) : le § 10 désigne les formateurs du planning (prof_ids), mais la
-- liste profs du planning n'est reliée à aucun compte. Est donc ayant droit au questionnaire fin_formateur d'un lieu
-- tout compte de l'équipe (rôle prof ou admin, sans fiche stagiaire) qui a accès (peut_acceder_promo) à au moins une
-- promo de ce lieu. Conséquence aujourd'hui : l'équipe voit toutes les promos, un formateur peut donc répondre pour
-- chaque lieu dont le questionnaire est ouvert (une fois par lieu et par année). Le lot 4 (rôles et portées) resserrera
-- peut_acceder_promo, et ce droit avec lui.
--
-- Droits de gestion : une seule fonction, peut_gerer_qualite(), qui vaut is_founder() aujourd'hui (le lot 4 l'élargira
-- en un seul endroit). Les commentaires, eux, restent au fondateur (is_founder()) : le lot 5 les ouvrira à la direction.
-- Refus en « questionnaire: <phrase> », la phrase étant montrée telle quelle par l'app.

-- 1. Questions attendues, par questionnaire et par version ---------------------------------------------------------
-- Miroir de js/questionnaires-data.js (le commentaire libre est une colonne à part, pas une question). Une question
-- modifiée crée une version nouvelle : on ajoute ses lignes, les anciennes restent pour les réponses déjà données.
create table public.questionnaire_questions (
  cle text not null check (cle in ('fin_stagiaire', 'six_mois_stagiaire', 'fin_formateur')),
  version integer not null check (version >= 1),
  question_id text not null check (question_id ~ '^[a-z_]{1,40}$' and question_id <> 'commentaire'),
  type text not null check (type in ('echelle', 'choix')),
  facultative boolean not null,
  options text[],
  primary key (cle, version, question_id),
  constraint questionnaire_questions_options
    check ((type = 'choix') = (options is not null and cardinality(options) >= 2))
);
insert into public.questionnaire_questions (cle, version, question_id, type, facultative, options) values
  ('fin_stagiaire', 1, 'objectifs', 'echelle', false, null),
  ('fin_stagiaire', 1, 'contenus', 'echelle', false, null),
  ('fin_stagiaire', 1, 'formateurs', 'echelle', false, null),
  ('fin_stagiaire', 1, 'organisation', 'echelle', false, null),
  ('fin_stagiaire', 1, 'accompagnement', 'echelle', false, null),
  ('fin_stagiaire', 1, 'preparation', 'echelle', false, null),
  ('fin_stagiaire', 1, 'recommandation', 'echelle', false, null),
  ('fin_stagiaire', 1, 'globalement', 'echelle', false, null),
  ('fin_stagiaire', 1, 'app', 'echelle', true, null),
  ('six_mois_stagiaire', 1, 'situation', 'choix', false, array['J''ai le titre et j''enseigne la conduite', 'J''ai le titre et je cherche un poste', 'Je n''ai pas encore le titre (examen à repasser ou à venir)', 'Je fais autre chose']),
  ('six_mois_stagiaire', 1, 'utile', 'echelle', false, null),
  ('six_mois_stagiaire', 1, 'preparation', 'echelle', false, null),
  ('six_mois_stagiaire', 1, 'globalement', 'echelle', false, null),
  ('fin_formateur', 1, 'objectifs', 'echelle', false, null),
  ('fin_formateur', 1, 'supports', 'echelle', false, null),
  ('fin_formateur', 1, 'organisation', 'echelle', false, null),
  ('fin_formateur', 1, 'niveau', 'echelle', false, null),
  ('fin_formateur', 1, 'suivi', 'echelle', false, null),
  ('fin_formateur', 1, 'globalement', 'echelle', false, null);

-- 2. Ouvertures manuelles (gestion) : elles priment sur les dates, dans les deux sens -------------------------------
create table public.questionnaire_ouvertures (
  cle text not null check (cle in ('fin_stagiaire', 'six_mois_stagiaire', 'fin_formateur')),
  promo_id integer references public.promos(id) on delete cascade,
  lieu_id integer references public.lieux(id) on delete cascade,
  annee integer check (annee between 2000 and 2100),
  ouvert boolean not null,
  par_email text not null,
  le timestamptz not null default now(),
  constraint questionnaire_ouvertures_portee check (case when cle = 'fin_formateur'
    then promo_id is null and lieu_id is not null and annee is not null
    else promo_id is not null and lieu_id is null and annee is null end),
  constraint questionnaire_ouvertures_unique unique nulls not distinct (cle, promo_id, lieu_id, annee)
);

-- 3. Participations : qui a répondu, sans date ni heure ------------------------------------------------------------
create table public.questionnaire_participations (
  cle text not null check (cle in ('fin_stagiaire', 'six_mois_stagiaire', 'fin_formateur')),
  promo_id integer references public.promos(id) on delete cascade,
  lieu_id integer references public.lieux(id) on delete cascade,
  annee integer check (annee between 2000 and 2100),
  user_id uuid not null references auth.users(id) on delete cascade,
  constraint questionnaire_participations_portee check (case when cle = 'fin_formateur'
    then promo_id is null and lieu_id is not null and annee is not null
    else promo_id is not null and lieu_id is null and annee is null end),
  constraint questionnaire_participations_unique unique nulls not distinct (cle, promo_id, lieu_id, annee, user_id)
);

-- 4. Réponses : ni utilisateur, ni date, ni numéro ------------------------------------------------------------------
create table public.questionnaire_reponses (
  id uuid primary key default gen_random_uuid(),
  cle text not null check (cle in ('fin_stagiaire', 'six_mois_stagiaire', 'fin_formateur')),
  version integer not null check (version >= 1),
  promo_id integer references public.promos(id) on delete cascade,
  lieu_id integer references public.lieux(id) on delete cascade,
  annee integer check (annee between 2000 and 2100),
  reponses jsonb not null check (jsonb_typeof(reponses) = 'object'),
  commentaire text check (commentaire is null or char_length(commentaire) between 1 and 2000),
  constraint questionnaire_reponses_portee check (case when cle = 'fin_formateur'
    then promo_id is null and lieu_id is not null and annee is not null
    else promo_id is not null and lieu_id is null and annee is null end)
);
create index questionnaire_reponses_portee_idx on public.questionnaire_reponses (cle, promo_id, lieu_id, annee);

-- 5. Droits sur les tables : rien en direct, sauf la lecture des ouvertures par la gestion -------------------------
alter table public.questionnaire_questions enable row level security;
alter table public.questionnaire_ouvertures enable row level security;
alter table public.questionnaire_participations enable row level security;
alter table public.questionnaire_reponses enable row level security;

revoke all on public.questionnaire_questions, public.questionnaire_ouvertures,
  public.questionnaire_participations, public.questionnaire_reponses from public, anon, authenticated, service_role;

-- 6. Droit de gestion de la qualité : une seule fonction, élargie plus tard en un seul endroit ---------------------
create or replace function public.peut_gerer_qualite()
returns boolean
language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select is_founder();
$function$;
revoke all on function public.peut_gerer_qualite() from public, anon;
grant execute on function public.peut_gerer_qualite() to authenticated, service_role;

create policy questionnaire_ouvertures_select on public.questionnaire_ouvertures
  for select to authenticated using ((select peut_gerer_qualite()));
grant select on public.questionnaire_ouvertures to authenticated;

-- 7. Outils internes (aucun droit d'appel depuis l'app : seules les fonctions ci-dessous s'en servent) ------------
-- Le jour, à l'heure de Paris.
create function public._questionnaire_jour()
returns date language sql stable set search_path to 'public', 'pg_temp' as $function$
  select (now() at time zone 'Europe/Paris')::date;
$function$;

-- Le public d'un questionnaire (nul si la clé est inconnue) et son seuil d'affichage.
create function public._questionnaire_public(p_cle text)
returns text language sql immutable set search_path to 'public', 'pg_temp' as $function$
  select case when p_cle in ('fin_stagiaire', 'six_mois_stagiaire') then 'stagiaire'
              when p_cle = 'fin_formateur' then 'formateur' end;
$function$;

create function public._questionnaire_seuil(p_cle text)
returns integer language sql immutable set search_path to 'public', 'pg_temp' as $function$
  select case when _questionnaire_public(p_cle) = 'formateur' then 3 else 5 end;
$function$;

-- La version en cours (la plus haute) ; nulle si la clé est inconnue.
create function public._questionnaire_version(p_cle text)
returns integer language sql stable set search_path to 'public', 'pg_temp' as $function$
  select max(version) from questionnaire_questions where cle = p_cle;
$function$;

-- Lit la portée envoyée par l'app : { "promo_id": n } pour les stagiaires, { "lieu_id": n, "annee": aaaa } pour les
-- formateurs, rien d'autre. Refus si elle est mal formée.
create function public._questionnaire_portee(p_cle text, p_portee jsonb,
  out promo_id integer, out lieu_id integer, out annee integer)
language plpgsql immutable set search_path to 'public', 'pg_temp' as $function$
declare
  v_cles text[];
begin
  if p_portee is null or jsonb_typeof(p_portee) <> 'object' then
    raise exception 'questionnaire: Portée du questionnaire illisible.';
  end if;
  select array_agg(k order by k) into v_cles from jsonb_object_keys(p_portee) k;
  if _questionnaire_public(p_cle) = 'formateur' then
    if v_cles is distinct from array['annee', 'lieu_id']
       or jsonb_typeof(p_portee -> 'lieu_id') <> 'number' or (p_portee ->> 'lieu_id') !~ '^[0-9]{1,9}$'
       or jsonb_typeof(p_portee -> 'annee') <> 'number' or (p_portee ->> 'annee') !~ '^[0-9]{4}$' then
      raise exception 'questionnaire: Portée du questionnaire illisible.';
    end if;
    lieu_id := (p_portee ->> 'lieu_id')::integer;
    annee := (p_portee ->> 'annee')::integer;
    if annee not between 2000 and 2100 then
      raise exception 'questionnaire: Portée du questionnaire illisible.';
    end if;
  else
    if v_cles is distinct from array['promo_id']
       or jsonb_typeof(p_portee -> 'promo_id') <> 'number' or (p_portee ->> 'promo_id') !~ '^[0-9]{1,9}$' then
      raise exception 'questionnaire: Portée du questionnaire illisible.';
    end if;
    promo_id := (p_portee ->> 'promo_id')::integer;
  end if;
end;
$function$;

-- La personne connectée a-t-elle le droit de répondre ? Stagiaire : sa fiche (liée au compte, non anonymisée) est dans
-- la promo. Formateur : compte de l'équipe sans fiche stagiaire, qui a accès à au moins une promo du lieu (R1).
create function public._questionnaire_ayant_droit(p_cle text, p_promo integer, p_lieu integer)
returns boolean language sql stable set search_path to 'public', 'pg_temp' as $function$
  select case _questionnaire_public(p_cle)
    when 'stagiaire' then exists (
      select 1 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
       where lower(up.email) = lower((select auth.jwt() ->> 'email'))
         and s.promo_id = p_promo and s.anonymise_le is null)
    when 'formateur' then exists (
      select 1 from user_profiles up
       where lower(up.email) = lower((select auth.jwt() ->> 'email'))
         and up.role in ('prof', 'admin') and up.stagiaire_id is null
         and exists (select 1 from promos pr where pr.lieu_id = p_lieu and peut_acceder_promo(pr.id)))
    else false end;
$function$;

-- Le questionnaire est-il ouvert aujourd'hui pour cette portée ? Comme estOuvert() de js/questionnaires-rules.js :
-- l'ouverture manuelle prime ; sinon la fenêtre (bornes comprises) d'une promo à date de fin connue. Pour les
-- formateurs : l'année de la portée est celle du jour, et une promo du lieu au moins est dans sa fenêtre.
create function public._questionnaire_ouvert(p_cle text, p_promo integer, p_lieu integer, p_annee integer)
returns boolean language sql stable set search_path to 'public', 'pg_temp' as $function$
  select coalesce(
    (select o.ouvert from questionnaire_ouvertures o
      where o.cle = p_cle and o.promo_id is not distinct from p_promo
        and o.lieu_id is not distinct from p_lieu and o.annee is not distinct from p_annee),
    case p_cle
      when 'fin_stagiaire' then exists (
        select 1 from promos pr where pr.id = p_promo and d.jour between pr.date_fin - 7 and pr.date_fin + 30)
      when 'six_mois_stagiaire' then exists (
        select 1 from promos pr where pr.id = p_promo
           and d.jour between (pr.date_fin + interval '6 months')::date and (pr.date_fin + interval '7 months')::date)
      when 'fin_formateur' then p_annee = extract(year from d.jour)::integer and exists (
        select 1 from promos pr where pr.lieu_id = p_lieu and d.jour between pr.date_fin - 7 and pr.date_fin + 30)
      else false end)
  from (select _questionnaire_jour() as jour) d;
$function$;

revoke all on function public._questionnaire_jour(), public._questionnaire_public(text),
  public._questionnaire_seuil(text), public._questionnaire_version(text),
  public._questionnaire_portee(text, jsonb), public._questionnaire_ayant_droit(text, integer, integer),
  public._questionnaire_ouvert(text, integer, integer, integer)
  from public, anon, authenticated, service_role;

-- 8. Questionnaires à remplir par la personne connectée : clé, version en cours, portée --------------------------
create function public.questionnaires_a_remplir()
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

-- 9. Répondre : ayant droit, fenêtre, première réponse, forme ; puis la participation et la réponse, ensemble ------
create function public.repondre_questionnaire(p_cle text, p_portee jsonb, p_version integer, p_reponses jsonb,
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
  -- un nouvel identifiant ; aucune ne garde le numéro de transaction ni le rang de son arrivée.
  for v_id in
    select r.id from questionnaire_reponses r
     where r.cle = p_cle and r.promo_id is not distinct from v_portee.promo_id
       and r.lieu_id is not distinct from v_portee.lieu_id and r.annee is not distinct from v_portee.annee
     order by random()
  loop
    update questionnaire_reponses set id = gen_random_uuid() where id = v_id;
  end loop;
end;
$function$;

-- 10. Résultats (gestion) : comptes par question, rien sous le seuil --------------------------------------------
-- { cle, public, seuil, reponses: n ou null sous le seuil, questions: { question: { valeur: nombre } } } ; valeur =
-- « 1 » à « 4 », « sans_avis », ou l'option d'un choix ; une question n'apparaît que si elle a au moins le seuil de
-- réponses (« sans avis » compris), toutes versions confondues.
create function public.resultats_questionnaire(p_cle text, p_portee jsonb)
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

-- 11. Commentaires (fondateur) : ordre tiré au hasard, à partir du seuil de réponses de la portée ----------------
create function public.commentaires_questionnaire(p_cle text, p_portee jsonb)
returns setof text
language plpgsql volatile security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_portee record;
  n integer;
begin
  if not is_founder() then
    raise exception 'questionnaire: Réservé à l''éditeur.';
  end if;
  if _questionnaire_version(p_cle) is null then
    raise exception 'questionnaire: Questionnaire inconnu.';
  end if;
  select * into v_portee from _questionnaire_portee(p_cle, p_portee);
  select count(*) into n from questionnaire_reponses r
   where r.cle = p_cle and r.promo_id is not distinct from v_portee.promo_id
     and r.lieu_id is not distinct from v_portee.lieu_id and r.annee is not distinct from v_portee.annee;
  if n < _questionnaire_seuil(p_cle) then
    return;
  end if;
  return query
    select r.commentaire from questionnaire_reponses r
     where r.cle = p_cle and r.promo_id is not distinct from v_portee.promo_id
       and r.lieu_id is not distinct from v_portee.lieu_id and r.annee is not distinct from v_portee.annee
       and r.commentaire is not null
     order by random();
end;
$function$;

-- 12. Ouvrir ou fermer à la main (gestion) ; p_ouvert nul : on revient aux dates -------------------------------
create function public.ouvrir_questionnaire(p_cle text, p_portee jsonb, p_ouvert boolean)
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

revoke all on function public.questionnaires_a_remplir() from public, anon;
revoke all on function public.repondre_questionnaire(text, jsonb, integer, jsonb, text) from public, anon;
revoke all on function public.resultats_questionnaire(text, jsonb) from public, anon;
revoke all on function public.commentaires_questionnaire(text, jsonb) from public, anon;
revoke all on function public.ouvrir_questionnaire(text, jsonb, boolean) from public, anon;
grant execute on function public.questionnaires_a_remplir() to authenticated;
grant execute on function public.repondre_questionnaire(text, jsonb, integer, jsonb, text) to authenticated;
grant execute on function public.resultats_questionnaire(text, jsonb) to authenticated;
grant execute on function public.commentaires_questionnaire(text, jsonb) to authenticated;
grant execute on function public.ouvrir_questionnaire(text, jsonb, boolean) to authenticated;
