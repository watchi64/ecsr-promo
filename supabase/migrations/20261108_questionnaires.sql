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
--    seuil ; les commentaires par une autre, au fondateur seul (hors aperçu), dans un ordre tiré au hasard.
--  - questionnaire_participations garde (questionnaire, portée, utilisateur), sans date : elle éteint le bandeau et
--    refuse un deuxième envoi. Elle n'a aucune colonne commune avec les réponses hors de la portée.
--  - Postgres marque chaque ligne du numéro de la transaction qui l'a écrite (colonne système xmin) : la réponse et la
--    participation écrites ensemble porteraient le même, et l'ordre de ces numéros (comme l'ordre physique des lignes)
--    suivrait l'ordre d'arrivée. Chaque nouvelle réponse réécrit donc toutes les réponses de sa portée, une à une dans
--    un ordre tiré au hasard et avec un nouvel identifiant : elles partagent alors toutes le numéro de la dernière
--    transaction. Le commentaire et les réponses sont recopiés au passage (commentaire || '', reponses || '{}') : une
--    valeur longue, rangée à part dans la table TOAST de Postgres, y garderait sinon le numéro de transaction de son
--    envoi et un identifiant de morceau croissant (l'ordre d'arrivée).
--  - Deux envois simultanés dans une même portée : sans précaution, le brassage du second sauterait les lignes que le
--    premier tient verrouillées, et la réponse du second resterait seule avec son numéro, celui de sa participation.
--    Un verrou consultatif par portée (pg_advisory_xact_lock), pris avant le contrôle de la fenêtre et de la première
--    réponse, met donc les envois d'une portée en file : le second attend la fin du premier, puis voit et brasse
--    toutes les réponses.
--  - Reste hors de portée de la base : les sauvegardes et le journal des transactions gardent l'historique ; les
--    anciennes versions des lignes restent lisibles par un superutilisateur (extension pageinspect) jusqu'au passage du
--    nettoyage automatique ; quelqu'un qui relèverait les résultats après chaque réponse en déduirait la dernière par
--    différence (le seuil limite ce risque sans l'annuler) ; pour qui lit les tables elles-mêmes (éditeur SQL), une
--    portée qui n'a qu'une participation relie celle-ci à son unique réponse (une chance sur deux à deux répondants) :
--    c'est inhérent au modèle, seuls les écrans et les documents appliquent le seuil ; enfin le rang physique n'est
--    brassé qu'à peu près : une ligne réécrite reste sur sa page quand il y a de la place, et sur plusieurs pages, la
--    page d'une réponse garde un lien grossier avec l'époque de son arrivée.
--  - La participation est liée au compte (auth.users, effacée avec lui) : un compte supprimé puis recréé (nouvel
--    identifiant, même adresse) pourrait répondre une seconde fois. À reprendre avec la conservation (lot Q5).
--  - Les réponses sont des preuves Qualiopi (3 ans) : supprimer une promo ou un lieu qui en porte est refusé
--    (on delete restrict) ; l'app ne supprime ni promo ni lieu.
--
-- Droits, au modèle du lot 4 (rôles et portées, migrations 20261028_roles_1 à 3, appliquées en production le 08/11).
-- Ce texte a d'abord été écrit sur l'ancien modèle (colonnes role et is_admin de user_profiles) ; il a été réaligné le
-- 09/11 (tâche 3b), avant toute application, sur le vocabulaire du lot 4 :
--  - Formateur ayant droit (écart à la spec, décision R1 du contrôleur, 08/11 : le § 10 désigne les formateurs du
--    planning, dont la liste n'est reliée à aucun compte) : le questionnaire fin_formateur d'un lieu revient à qui est
--    formateur, au sens du lot 4, d'au moins une promo de ce lieu : une affectation formateur sur cette promo, lue par
--    roles_reels() (rôles réels, sans aperçu ni statut de fondateur), et pas de fiche stagiaire. R1 s'applique donc
--    pour de bon : un formateur d'un autre lieu, un ancien formateur sans affectation, la direction ou le siège seuls,
--    le fondateur sans affectation sont refusés. Les colonnes role et is_admin ne décident plus de rien (lot 4).
--  - Stagiaire ayant droit : inchangé hors aperçu (sa fiche, liée au compte et non anonymisée, est dans la promo).
--  - Formateur encore ayant droit (limite, à valider par Timy) : une affectation du lot 4 n'a pas de date de fin. Un
--    formateur affecté à une promo du lieu, même finie depuis des années, reste ayant droit chaque année tant que la
--    ligne d'affectation existe ; la retirer (direction du lieu ou fondateur) suffit à l'exclure.
--  - Aperçu (en-tête x-apercu-role, « Voir en tant que ») : comme au lot 4, il ne fait que retirer des droits, et une
--    réponse est une écriture réelle et définitive. En aperçu, personne ne répond comme formateur (le fondateur en
--    aperçu formateur ne répond pas à la place d'un formateur ; un formateur qui se voit « comme un stagiaire » ne se
--    voit rien proposer). L'aperçu stagiaire suit my_stagiaire_id() : il garde le questionnaire de la fiche de
--    l'appelant, et seulement quand cette fiche est dans la promo affichée (promo_courante(), en-tête x-promo-id ; sans
--    en-tête, la promo de la fiche). Le fondateur qui a une fiche stagiaire n'a rien en aperçu formateur, direction ou
--    siège.
--  - Gestion : une seule fonction, peut_gerer_qualite(), qui vaut est_fondateur() : le fondateur réel, hors aperçu
--    (en aperçu, il n'a que les droits du rôle simulé : ni ouvertures, ni résultats, ni commentaires). Ni l'ancien
--    rôle admin, ni la direction, ni le siège (la direction et le siège sont hors du lot Q3 : lot 5 de la refonte, qui
--    élargira cette fonction en un seul endroit).
--  - Commentaires : est_fondateur() seul ; le lot 5 les ouvrira à la direction.
-- is_founder() (qui vaut est_fondateur() depuis le lot 4) n'est plus citée : le lot 4 la garde pour la compatibilité,
-- à ne plus utiliser dans du code neuf.
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
  promo_id integer references public.promos(id) on delete restrict,
  lieu_id integer references public.lieux(id) on delete restrict,
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
-- Le fondateur réel, hors aperçu (est_fondateur() du lot 4).
create or replace function public.peut_gerer_qualite()
returns boolean
language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select est_fondateur();
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
-- la promo, hors aperçu ou en aperçu stagiaire sur cette promo affichée. Formateur (R1, lot 4) : hors aperçu, sans fiche,
-- formateur réel (roles_reels) d'au moins une promo du lieu. Voir l'en-tête.
create function public._questionnaire_ayant_droit(p_cle text, p_promo integer, p_lieu integer)
returns boolean language sql stable set search_path to 'public', 'pg_temp' as $function$
  select case _questionnaire_public(p_cle)
    when 'stagiaire' then (apercu_role() is null
                           or (apercu_role() = 'stagiaire' and coalesce(p_promo = promo_courante(), false))) and exists (
      select 1 from user_profiles up join stagiaires s on s.id = up.stagiaire_id
       where lower(up.email) = lower((select auth.jwt() ->> 'email'))
         and s.promo_id = p_promo and s.anonymise_le is null)
    when 'formateur' then apercu_role() is null and exists (
      select 1 from user_profiles up
       where lower(up.email) = lower((select auth.jwt() ->> 'email'))
         and up.stagiaire_id is null
         and exists (select 1 from promos pr where pr.lieu_id = p_lieu and 'formateur' = any (roles_reels(pr.id))))
    else false end;
$function$;

-- Fenêtre d'un questionnaire pour une date de fin, bornes comprises (fenetreQuestionnaire() de
-- js/questionnaires-rules.js) : fin_stagiaire et fin_formateur de J-7 à J+30 ; six_mois_stagiaire de +6 mois à +7 mois,
-- ramené au dernier jour du mois quand le jour n'existe pas (31/08 + 6 mois = 28/02). Nulle sans date de fin.
create function public._questionnaire_fenetre(p_cle text, p_date_fin date, out du date, out au date)
language sql immutable set search_path to 'public', 'pg_temp' as $function$
  select case when p_cle = 'six_mois_stagiaire' then (p_date_fin + interval '6 months')::date
              when p_cle in ('fin_stagiaire', 'fin_formateur') then p_date_fin - 7 end,
         case when p_cle = 'six_mois_stagiaire' then (p_date_fin + interval '7 months')::date
              when p_cle in ('fin_stagiaire', 'fin_formateur') then p_date_fin + 30 end;
$function$;

-- Le questionnaire est-il ouvert aujourd'hui pour cette portée ? Comme estOuvert() de js/questionnaires-rules.js :
-- l'ouverture manuelle prime ; sinon la fenêtre d'une promo à date de fin connue. Pour les formateurs : l'année de la
-- portée est celle du jour, et une promo du lieu au moins est dans sa fenêtre.
create function public._questionnaire_ouvert(p_cle text, p_promo integer, p_lieu integer, p_annee integer)
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

revoke all on function public._questionnaire_jour(), public._questionnaire_public(text),
  public._questionnaire_fenetre(text, date),
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
  if not est_fondateur() then
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
