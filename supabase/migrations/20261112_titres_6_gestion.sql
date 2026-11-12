-- Titres et droits à la carte, étape 2b (gestion), migration 6. Aucun fichier de l'app ne change, rien ne se voit : le verrou des titres
-- non fixes reste fermé (aucun titre non fixe n'est donnable) jusqu'à ce que le fondateur le lève (étape 4). Pour les titres fixes,
-- chaque réponse reste celle d'aujourd'hui.
--   A. Le verrou et les aides de décision : la clé globale « titres_ouverts » des réglages (titres_ouverts(), regler_titres_ouverts),
--      _cases_effectives (les cases d'un titre, un titre fixe au plafond de chaque page), _depasse (la première page où un jeu de cases
--      ouvre plus qu'un autre), _cases_appelant (les cases de l'appelant à un niveau) et _refus_titre : les six règles du § 7 de la spec
--      en une seule aide, partagée par donner et retirer.
--   B. donner_titre (tous les titres, fixes ou non, par _refus_titre) et retirer_titre étendu aux titres non fixes (un bloc de fragments,
--      outils/generer_fragments_titres_6.py : ne pas le modifier à la main).
--   C. creer_titre, ajuster_titre, supprimer_titre, l'aide _refus_gestion (les règles du § 7 pour gérer les titres) ; la contrainte
--      titres_centre_requis disparaît (un titre de promo ou de centre sans centre est un titre du réseau, utilisable dans tous les centres).
--   D. Les lectures de l'étape 3 : titres_visibles, mes_titres, personnes_et_titres, journal_des_droits (rend une liste vide quand la table du
--      journal, migration 4, n'est pas appliquée).
-- Les phrases de refus commencent par « titres: », au vouvoiement ; un droit manquant lève l'état 42501. Toute fonction nouvelle est
-- security definer, search_path public puis pg_temp, adresse du jeton comparée en minuscules ; les aides internes (préfixe _) n'ont aucun
-- droit d'exécution. Le retour (20261112_titres_6_gestion_retour.sql) remet la base dans l'état d'avant, partie par partie, dans l'ordre inverse.
set local lock_timeout = '3s';

-- A. Le verrou et les aides de décision ---------------------------------------------------------------------------------------------

-- La clé « titres_ouverts » rejoint les clés globales admises sans promo. Garde : la contrainte en vigueur est celle de
-- 20261108_espaces_3_habillage.sql (quatre clés, pas encore celle-ci) ; sinon la migration s'arrête sans rien changer.
do $garde_a$
declare
  v_def text;
begin
  select pg_get_constraintdef(c.oid) into v_def from pg_constraint c
   where c.conrelid = 'public.settings'::regclass and c.conname = 'settings_globaux_prevus';
  if v_def is null or v_def not like '%promo_id IS NOT NULL%' or v_def not like '%chatbot_quota_jour%' or v_def not like '%cohort_name%'
     or v_def not like '%password_hash%' or v_def not like '%habillage_reseau%' or v_def like '%titres_ouverts%'
     or (length(v_def) - length(replace(v_def, '::text', ''))) / length('::text') <> 4 then
    raise exception 'titres_6_gestion : la contrainte settings_globaux_prevus est absente ou n''est plus celle de 20261108_espaces_3_habillage ; rien n''est changé';
  end if;
end $garde_a$;

alter table public.settings drop constraint settings_globaux_prevus;
alter table public.settings add constraint settings_globaux_prevus
  check (promo_id is not null or key in ('chatbot_quota_jour', 'cohort_name', 'password_hash', 'habillage_reseau', 'titres_ouverts'));

-- Le verrou : vrai si la ligne globale vaut « oui ». Fermé par défaut (aucune ligne).
create function public.titres_ouverts()
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
  select coalesce((select s.value = 'oui' from settings s where s.promo_id is null and s.key = 'titres_ouverts'), false);
$f$;

-- Le fondateur seul (hors aperçu) lève ou ferme le verrou ; rend l'état.
create function public.regler_titres_ouverts(p_ouvert boolean)
returns boolean
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $f$
begin
  if auth.jwt() ->> 'email' is null or not coalesce(est_fondateur(), false) then
    raise exception 'titres: Réservé au fondateur.' using errcode = '42501';
  end if;
  if coalesce(p_ouvert, false) then
    insert into settings (key, value, promo_id) values ('titres_ouverts', 'oui', null)
    on conflict (promo_id, key) do update set value = excluded.value, updated_at = now();
    return true;
  end if;
  delete from settings where promo_id is null and key = 'titres_ouverts';
  return false;
end;
$f$;

-- Les cases d'un titre, toutes les pages de son niveau : un titre fixe est au plafond de chaque page, un titre non fixe donne ses
-- cases (une page absente vaut « non »). Nul pour un titre inconnu.
create function public._cases_effectives(p_titre_id bigint)
returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
  select jsonb_object_agg(pg.page,
           case when t.fixe then case pg.plafond when 2 then 'modifier' else 'voir' end
                else coalesce(nullif(t.cases ->> pg.page, ''), 'non') end)
    from titres t
   cross join lateral _pages_du_niveau(t.niveau) pg
   where t.id = p_titre_id;
$f$;

-- La première page où p_cases ouvre plus que p_limite (non < voir < modifier ; une page absente vaut « non »), dans l'ordre des pages du
-- niveau ; nul si p_cases ne dépasse nulle part. Le niveau se lit dans la limite (une limite complète porte « planning » au niveau promo,
-- « promos » au niveau centre, « directions » au niveau réseau) ; à défaut, l'ordre alphabétique des pages de p_cases.
create function public._depasse(p_cases jsonb, p_limite jsonb)
returns text
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
declare
  v_niveau text := case when p_limite ->> 'planning' is not null then 'promo'
                        when p_limite ->> 'promos' is not null then 'centre'
                        when p_limite ->> 'directions' is not null then 'reseau' end;
  v_pages text[];
  v_page text;
begin
  if v_niveau is null then
    v_pages := array(select k from jsonb_object_keys(coalesce(p_cases, '{}'::jsonb)) k order by k);
  else
    v_pages := array(select p.page from _pages_du_niveau(v_niveau) with ordinality as p(page, plafond, rang) order by p.rang);
  end if;
  foreach v_page in array v_pages loop
    if (case p_cases ->> v_page when 'modifier' then 2 when 'voir' then 1 else 0 end)
       > (case p_limite ->> v_page when 'modifier' then 2 when 'voir' then 1 else 0 end) then
      return v_page;
    end if;
  end loop;
  return null;
end;
$f$;

-- Les cases de l'appelant à un niveau (page par page, la plus large de ses titres : centre p_lieu_id, ou réseau). Le niveau promo n'est
-- jamais comparé : les titres de promo se donnent sans comparaison (§ 7, règle 3, même niveau seulement).
create function public._cases_appelant(p_niveau text, p_lieu_id integer)
returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
  select jsonb_object_agg(x.page, case x.rang when 2 then 'modifier' when 1 then 'voir' else 'non' end)
    from (
      select pg.page,
             coalesce((select max(case _cases_effectives(t.id) ->> pg.page when 'modifier' then 2 when 'voir' then 1 else 0 end)
                         from affectations af
                         join titres t on t.id = af.titre_id
                        where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                          and ((p_niveau = 'centre' and af.role = 'direction' and af.lieu_id = p_lieu_id)
                            or (p_niveau = 'reseau' and af.role = 'siege'))), 0) as rang
        from _pages_du_niveau(p_niveau) pg
    ) x;
$f$;

-- Les règles du § 7 de la spec, en une aide : rend (état, phrase) nuls si l'action est permise, sinon l'état à lever (42501 pour un
-- droit manquant, P0001 sinon) et la phrase. p_action : « donner » ou « retirer » ; p_cible : l'adresse de la personne concernée
-- (nulle pour lister les titres donnables : les règles « soi » et « compte stagiaire » ne jouent pas). Ordre des contrôles :
--   1. le titre existe, le centre est donné (niveaux promo et centre), le titre n'appartient pas à un autre centre ;
--   2. donner un titre non fixe : le verrou est levé ;
--   3. le droit : Formateur, la direction du centre ; Direction de centre, le siège ; Siège, le fondateur ; un titre non fixe, la case
--      Équipe (centre) ou Directions de centre (réseau) sur Modifier ; le fondateur passe toujours ;
--   4. jamais plus que soi, entre collègues du même niveau (titres de centre et du réseau non fixes seulement) ;
--   5. jamais sur soi (le fondateur, hors aperçu, et la direction qui se donne ou se retire Formateur exceptés) ;
--   6. donner : jamais à une adresse qui a une fiche de stagiaire.
create function public._refus_titre(p_titre_id bigint, p_lieu_id integer, p_cible text, p_action text, out etat text, out phrase text)
returns record
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
#variable_conflict use_column
declare
  t record;
  v_moi text := lower(auth.jwt() ->> 'email');
  v_cible text := lower(trim(coalesce(p_cible, '')));
  v_lieu integer := p_lieu_id;
  v_page text;
begin
  if p_action is null or p_action not in ('donner', 'retirer') then
    raise exception 'titres: action inconnue « % »', p_action using errcode = '22023';
  end if;
  select ti.niveau, ti.fixe, ti.lieu_id as lieu_du_titre into t from titres ti where ti.id = p_titre_id;
  -- 1. Le titre, le centre.
  if t.niveau is null then
    etat := 'P0001'; phrase := 'titres: Titre introuvable.'; return;
  end if;
  if t.niveau = 'reseau' then
    v_lieu := null; -- un titre du réseau ne porte sur aucun centre : le centre donné est ignoré
  elsif v_lieu is null or not exists (select 1 from lieux l where l.id = v_lieu) then
    etat := 'P0001'; phrase := 'titres: Le centre est requis.'; return;
  end if;
  if t.lieu_du_titre is not null and t.lieu_du_titre is distinct from v_lieu then
    etat := 'P0001'; phrase := 'titres: Ce titre appartient à un autre centre.'; return;
  end if;
  -- 2. Le verrou.
  if p_action = 'donner' and not t.fixe and not coalesce(titres_ouverts(), false) then
    etat := 'P0001'; phrase := 'titres: Ce titre ne peut pas encore être donné.'; return;
  end if;
  -- 3. Le droit.
  if not coalesce(est_fondateur(), false) then
    if t.fixe then
      if t.niveau = 'promo' then
        if not coalesce(geste_centre(v_lieu, 'formateurs.nommer'), false) then
          etat := '42501'; phrase := 'titres: Réservé à la direction du centre.'; return;
        end if;
      elsif t.niveau = 'centre' then
        if not coalesce(geste_reseau('directions.nommer'), false) then
          etat := '42501'; phrase := 'titres: Réservé au siège.'; return;
        end if;
      else
        etat := '42501'; phrase := 'titres: Réservé au fondateur.'; return;
      end if;
    elsif t.niveau = 'reseau' then
      if case_reseau('directions') <> 2 then
        etat := '42501'; phrase := 'titres: Réservé au réseau.'; return;
      end if;
    elsif t.niveau = 'promo' then
      if case_centre(v_lieu, 'equipe') <> 2 then
        etat := '42501'; phrase := 'titres: Réservé à l''équipe du centre.'; return;
      end if;
    else
      if case_centre(v_lieu, 'equipe') <> 2 and case_reseau('directions') <> 2 then
        etat := '42501'; phrase := 'titres: Réservé à l''équipe du centre.'; return;
      end if;
    end if;
  end if;
  -- 4. Jamais plus que soi : un titre de centre non fixe, par qui tient son droit de son titre de centre (ni la direction fixe du
  -- centre, ni la case Directions de centre du réseau) ; un titre du réseau non fixe, par qui n'a pas le titre fixe du siège.
  if not t.fixe and t.niveau = 'centre' and not coalesce(direction_fixe(v_lieu), false) and case_reseau('directions') <> 2 then
    v_page := _depasse(_cases_effectives(p_titre_id), _cases_appelant('centre', v_lieu));
  elsif not t.fixe and t.niveau = 'reseau' and not coalesce(siege_fixe(), false) then
    v_page := _depasse(_cases_effectives(p_titre_id), _cases_appelant('reseau', null));
  end if;
  if v_page is not null then
    etat := '42501'; phrase := 'titres: Ce titre ouvre plus que le vôtre (' || v_page || ').'; return;
  end if;
  -- 5. Jamais sur soi.
  if p_cible is not null and v_moi is not null and v_cible = v_moi and not coalesce(est_fondateur(), false)
     and not (t.niveau = 'promo' and t.fixe and coalesce(direction_fixe(v_lieu), false)) then
    etat := '42501';
    phrase := case when p_action = 'retirer' then 'titres: Vous ne pouvez pas retirer votre propre titre.'
                   else 'titres: Vous ne pouvez pas changer vos propres titres.' end;
    return;
  end if;
  -- 6. Aucun titre du personnel à un compte stagiaire.
  if p_action = 'donner' and p_cible is not null
     and exists (select 1 from user_profiles u where lower(u.email) = v_cible and u.stagiaire_id is not null) then
    etat := 'P0001'; phrase := 'titres: Cette adresse est celle d''un compte stagiaire.'; return;
  end if;
end;
$f$;

-- Droits : le verrou à authenticated seul ; les aides internes à personne.
revoke all on function public.titres_ouverts() from public, anon, service_role;
grant execute on function public.titres_ouverts() to authenticated;
revoke all on function public.regler_titres_ouverts(boolean) from public, anon, service_role;
grant execute on function public.regler_titres_ouverts(boolean) to authenticated;
revoke all on function public._cases_effectives(bigint) from public, anon, authenticated, service_role;
revoke all on function public._depasse(jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function public._cases_appelant(text, integer) from public, anon, authenticated, service_role;
revoke all on function public._refus_titre(bigint, integer, text, text) from public, anon, authenticated, service_role;

-- B. Donner et retirer ----------------------------------------------------------------------------------------------------------------
--   donner_titre(adresse, titre, centre, promos, fiche formateur) : tous les titres, fixes ou non, par les règles de _refus_titre. Crée le
--   profil s'il manque (formateur pour un titre de promo, compte du personnel sinon), transforme le compte d'un ancien stagiaire (sans
--   fiche), pose exactement les promos choisies pour un titre de promo, remplace l'ancien titre de la personne au même niveau dans ce
--   centre (ou au réseau) après avoir vérifié qu'on pourrait le retirer. Un titre du réseau de niveau promo ou centre qui a une version
--   dans ce centre se donne sous sa version. Rend {email, titre_id, cree, transforme, remplace, ajoutees, retirees}.
--   retirer_titre : un bloc de fragments remplace la ligne de refus des titres non fixes et les contrôles de la migration 5 par _refus_titre.
create function public.donner_titre(p_email text, p_titre_id bigint, p_lieu_id integer, p_promo_ids integer[] default null, p_prof_id integer default null)
returns jsonb
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $f$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_moi text := lower(auth.jwt() ->> 'email');
  v_titre_id bigint := p_titre_id;
  t record;
  v_lieu integer;
  v_etat text;
  v_phrase text;
  v_liste integer[] := '{}';
  v_cible text;
  v_cree boolean := false;
  v_transforme boolean := false;
  v_anciens bigint[];
  v_ancien bigint;
  v_remplace bigint;
  v_ajoutees integer[] := '{}';
  v_retirees integer[] := '{}';
  v_n bigint;
begin
  if v_moi is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  if v_email !~ '^\S+@\S+\.\S+$' then
    raise exception 'titres: Adresse e-mail invalide.';
  end if;
  -- Un titre du réseau (niveau promo ou centre, sans centre) qui a une version dans ce centre se donne sous sa version.
  select v.id into v_ancien from titres r join titres v on v.origine_id = r.id and v.lieu_id = p_lieu_id
   where r.id = p_titre_id and r.lieu_id is null and r.niveau in ('promo', 'centre') and not r.fixe;
  if v_ancien is not null then
    v_titre_id := v_ancien;
  end if;
  select r.etat, r.phrase into v_etat, v_phrase from _refus_titre(v_titre_id, p_lieu_id, v_email, 'donner') r;
  if v_etat is not null then
    raise exception '%', v_phrase using errcode = v_etat;
  end if;
  select ti.niveau, ti.fixe into t from titres ti where ti.id = v_titre_id;
  v_lieu := case when t.niveau = 'reseau' then null else p_lieu_id end;
  -- Les promos d'un titre de promo : au moins une, toutes du centre.
  if t.niveau = 'promo' then
    select coalesce(array_agg(distinct x order by x), '{}') into v_liste from unnest(coalesce(p_promo_ids, '{}')) x where x is not null;
    if cardinality(v_liste) = 0 then
      raise exception 'titres: Choisissez au moins une promo.';
    end if;
    if exists (select 1 from unnest(v_liste) x where not exists (select 1 from promos p where p.id = x and p.lieu_id = v_lieu)) then
      raise exception 'titres: Une promo choisie n''est pas dans ce centre.';
    end if;
  end if;
  -- Le compte d'un ancien stagiaire (sans fiche) devient un compte du personnel ; un profil manquant est créé.
  v_transforme := _orphelin_en_personnel(v_email, t.niveau = 'promo', case when t.niveau = 'promo' then p_prof_id end, v_moi);
  select u.email into v_cible from user_profiles u where lower(u.email) = v_email;
  if v_cible is null then
    if t.niveau = 'promo' then
      v_cree := _profil_formateur(v_email, p_prof_id, v_moi);
    else
      insert into user_profiles (email, role, is_admin, invited_by_email) values (v_email, 'prof', false, v_moi)
      on conflict (email) do nothing;
      get diagnostics v_n = row_count;
      v_cree := v_n > 0;
    end if;
    v_cible := v_email;
  end if;
  -- Un titre par niveau et par centre (ou au réseau) : l'ancien titre, s'il y en a un, est retiré, et il obéit aux règles du retrait.
  if t.niveau = 'promo' then
    select array_agg(distinct a.titre_id) into v_anciens from affectations a join promos p on p.id = a.promo_id
     where lower(a.email) = lower(v_cible) and a.role = 'formateur' and p.lieu_id = v_lieu and a.titre_id <> v_titre_id;
  elsif t.niveau = 'centre' then
    select array_agg(distinct a.titre_id) into v_anciens from affectations a
     where lower(a.email) = lower(v_cible) and a.role = 'direction' and a.lieu_id = v_lieu and a.titre_id <> v_titre_id;
  else
    select array_agg(distinct a.titre_id) into v_anciens from affectations a
     where lower(a.email) = lower(v_cible) and a.role = 'siege' and a.titre_id <> v_titre_id;
  end if;
  foreach v_ancien in array coalesce(v_anciens, '{}') loop
    select r.etat, r.phrase into v_etat, v_phrase from _refus_titre(v_ancien, v_lieu, v_cible, 'retirer') r;
    if v_etat is not null then
      raise exception '%', v_phrase using errcode = v_etat;
    end if;
    v_remplace := coalesce(v_remplace, v_ancien);
  end loop;
  -- Les lignes de l'ancien titre sont supprimées, puis les nouvelles posées (le déclencheur refuse un changement de titre en place).
  if t.niveau = 'promo' then
    delete from affectations a
     where lower(a.email) = lower(v_cible) and a.role = 'formateur' and a.titre_id = any (coalesce(v_anciens, '{}'))
       and a.promo_id in (select p.id from promos p where p.lieu_id = v_lieu);
    with retire as (
      delete from affectations a
       where lower(a.email) = lower(v_cible) and a.role = 'formateur' and a.titre_id = v_titre_id
         and a.promo_id in (select p.id from promos p where p.lieu_id = v_lieu)
         and not (a.promo_id = any (v_liste))
      returning a.promo_id)
    select coalesce(array_agg(r.promo_id order by r.promo_id), '{}') into v_retirees from retire r;
    with ajoute as (
      insert into affectations (email, role, promo_id, titre_id)
      select v_cible, 'formateur', x, v_titre_id from unnest(v_liste) x
      on conflict do nothing
      returning promo_id)
    select coalesce(array_agg(a.promo_id order by a.promo_id), '{}') into v_ajoutees from ajoute a;
  elsif t.niveau = 'centre' then
    delete from affectations a
     where lower(a.email) = lower(v_cible) and a.role = 'direction' and a.lieu_id = v_lieu and a.titre_id = any (coalesce(v_anciens, '{}'));
    insert into affectations (email, role, lieu_id, titre_id) values (v_cible, 'direction', v_lieu, v_titre_id)
    on conflict do nothing;
  else
    delete from affectations a
     where lower(a.email) = lower(v_cible) and a.role = 'siege' and a.titre_id = any (coalesce(v_anciens, '{}'));
    insert into affectations (email, role, titre_id) values (v_cible, 'siege', v_titre_id)
    on conflict do nothing;
  end if;
  return jsonb_build_object('email', v_cible, 'titre_id', v_titre_id, 'cree', v_cree, 'transforme', v_transforme,
                            'remplace', v_remplace, 'ajoutees', to_jsonb(v_ajoutees), 'retirees', to_jsonb(v_retirees));
end;
$f$;

revoke all on function public.donner_titre(text, bigint, integer, integer[], integer) from public, anon, service_role;
grant execute on function public.donner_titre(text, bigint, integer, integer[], integer) to authenticated;

-- retirer_titre : les titres non fixes se retirent, par les mêmes règles que donner (bloc de outils/generer_fragments_titres_6.py aller).
do $migration$
declare
  v_fonctions text[] := array[
    'public.retirer_titre(text, bigint, integer)'];
  -- La fonction de chaque fragment (rang dans v_fonctions).
  v_de integer[] := array[1, 1];
  v_anciens text[] := array[
$ancien$  v_n integer;
begin
  if v_moi is null then
$ancien$,
$ancien$  -- Les titres non fixes se retireront à la migration 6 (cette ligne seule est alors remplacée).
  if not v_fixe then
    raise exception 'titres: Ce titre ne se retire pas encore ici.';
  end if;
  -- Un titre du réseau ne porte sur aucun centre : le centre donné est ignoré.
  if v_niveau = 'reseau' then
    v_lieu := null;
  elsif v_lieu is null or not exists (select 1 from lieux l where l.id = v_lieu) then
    raise exception 'titres: Le centre est requis.';
  end if;
  -- Le droit : Formateur, la direction du centre (ou le fondateur) ; Direction de centre, le siège (ou le fondateur) ; Siège, le fondateur.
  if v_niveau = 'promo' then
    if not geste_centre(v_lieu, 'formateurs.nommer') then
      raise exception 'titres: Réservé à la direction du centre.' using errcode = '42501';
    end if;
  elsif v_niveau = 'centre' then
    if not geste_reseau('directions.nommer') then
      raise exception 'titres: Réservé au siège.' using errcode = '42501';
    end if;
  else
    if not est_fondateur() then
      raise exception 'titres: Réservé au fondateur.' using errcode = '42501';
    end if;
  end if;
  -- Jamais sur soi : la seule exception est la directrice qui forme, qui retire son propre titre FIXE Formateur (et non un titre de promo
  -- quelconque : un titre non fixe, retirable à la migration 6, reste soumis à la règle) ; le fondateur (hors aperçu) retire ce qu'il veut.
  if v_email = v_moi and (v_niveau <> 'promo' or not v_fixe) and not est_fondateur() then
    raise exception 'titres: Vous ne pouvez pas retirer votre propre titre.' using errcode = '42501';
  end if;
$ancien$];
  v_nouveaux text[] := array[
$nouveau$  v_n integer;
  v_etat text;
  v_phrase text;
begin
  if v_moi is null then
$nouveau$,
$nouveau$  -- Un titre du réseau ne porte sur aucun centre : le centre donné est ignoré.
  if v_niveau = 'reseau' then
    v_lieu := null;
  elsif v_lieu is null or not exists (select 1 from lieux l where l.id = v_lieu) then
    raise exception 'titres: Le centre est requis.';
  end if;
  -- Les règles du § 7 (titre d'un autre centre, droit, jamais plus que soi, jamais sur soi) sont celles de donner_titre : une seule aide.
  -- Retirer obéit aux mêmes règles que donner : on ne retire que ce qu'on pourrait donner (le verrou des titres non fixes mis à part).
  select r.etat, r.phrase into v_etat, v_phrase from _refus_titre(p_titre_id, v_lieu, v_email, 'retirer') r;
  if v_etat is not null then
    raise exception '%', v_phrase using errcode = v_etat;
  end if;
$nouveau$];
  f integer;
  i integer;
  v_oid regprocedure;
  v_def text;
  v_ancien text;
  v_nouveau text;
  n integer;
begin
  -- Le bloc est atomique : une fonction absente, un fragment manquant ou en double annule tout, rien n'est changé.
  for f in 1..cardinality(v_fonctions) loop
    v_oid := to_regprocedure(v_fonctions[f]);
    if v_oid is null then
      raise exception 'titres_6_gestion : % n''existe pas ; rien n''est changé', v_fonctions[f];
    end if;
    v_def := pg_get_functiondef(v_oid);
    for i in 1..cardinality(v_de) loop
      if v_de[i] <> f then continue; end if;
      v_ancien := v_anciens[i];
      v_nouveau := v_nouveaux[i];
      -- Une définition posée depuis un fichier à fins de ligne Windows garde ses retours chariot : les fragments suivent.
      if position(E'\r' in v_def) > 0 then
        v_ancien := replace(v_ancien, E'\n', E'\r\n');
        v_nouveau := replace(v_nouveau, E'\n', E'\r\n');
      end if;
      n := (length(v_def) - length(replace(v_def, v_ancien, ''))) / length(v_ancien);
      if n <> 1 then
        raise exception 'titres_6_gestion : le fragment % attendu dans % est présent % fois (une seule attendue) ; rien n''est changé', i, v_fonctions[f], n;
      end if;
      v_def := replace(v_def, v_ancien, v_nouveau);
    end loop;
    execute v_def;
  end loop;
end
$migration$;

-- C. Créer, ajuster, supprimer un titre -----------------------------------------------------------------------------------------------
--   La contrainte titres_centre_requis disparaît : un titre de promo ou de centre sans centre est un titre du réseau, utilisable dans tous
--   les centres (le catalogue de la spec, § 6.2) ; un titre de niveau réseau n'a jamais de centre (contrainte titres_reseau_sans_centre).
--   _refus_gestion(niveau, centre, cases) : les règles du § 7 pour créer, ajuster et supprimer (mêmes phrases que _refus_titre). Rend la
--   phrase du refus (toujours 42501), nulle si c'est permis. Titre de centre (centre donné, niveau promo ou centre) : Équipe sur Modifier
--   (pour un titre de niveau centre, ou Directions de centre sur Modifier), et, pour un titre de niveau centre, des cases au plus égales
--   à celles de l'appelant sauf direction fixe ou Directions de centre sur Modifier ; titre du réseau (sans centre) : Directions de centre
--   sur Modifier, et, pour le niveau réseau, des cases au plus égales aux siennes sauf siège fixe. Le fondateur passe toujours.
--   creer_titre(depuis, nom, centre) : un titre part toujours d'un titre existant, même niveau, mêmes cases.
--   ajuster_titre(titre, centre, nom, cases) : cases et nom d'un titre non fixe, que l'appelant ne porte pas. Un titre du réseau (niveau promo
--   ou centre) ajusté depuis un centre crée la version de ce centre et y fait passer les personnes de ce centre qui le portaient.
--   supprimer_titre(titre) : un titre non fixe, que plus personne ne porte.
do $garde_c$
begin
  if not exists (select 1 from pg_constraint c where c.conrelid = 'public.titres'::regclass and c.conname = 'titres_centre_requis') then
    raise exception 'titres_6_gestion : la contrainte titres_centre_requis est absente ; rien n''est changé';
  end if;
end $garde_c$;

alter table public.titres drop constraint titres_centre_requis;

create function public._refus_gestion(p_niveau text, p_lieu_id integer, p_cases jsonb)
returns text
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
declare
  v_page text;
begin
  if coalesce(est_fondateur(), false) then
    return null;
  end if;
  if p_lieu_id is not null and p_niveau in ('promo', 'centre') then
    if p_niveau = 'promo' then
      if case_centre(p_lieu_id, 'equipe') <> 2 then
        return 'titres: Réservé à l''équipe du centre.';
      end if;
    else
      if case_centre(p_lieu_id, 'equipe') <> 2 and case_reseau('directions') <> 2 then
        return 'titres: Réservé à l''équipe du centre.';
      end if;
      if not coalesce(direction_fixe(p_lieu_id), false) and case_reseau('directions') <> 2 then
        v_page := _depasse(p_cases, _cases_appelant('centre', p_lieu_id));
      end if;
    end if;
  else
    if case_reseau('directions') <> 2 then
      return 'titres: Réservé au réseau.';
    end if;
    if p_niveau = 'reseau' and not coalesce(siege_fixe(), false) then
      v_page := _depasse(p_cases, _cases_appelant('reseau', null));
    end if;
  end if;
  if v_page is not null then
    return 'titres: Ce titre ouvre plus que le vôtre (' || v_page || ').';
  end if;
  return null;
end;
$f$;

create function public.creer_titre(p_depuis bigint, p_nom text, p_lieu_id integer)
returns bigint
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $f$
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  v_nom text := trim(coalesce(p_nom, ''));
  src record;
  v_lieu integer;
  v_cases jsonb;
  v_phrase text;
  v_id bigint;
begin
  if v_moi is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  select ti.niveau, ti.lieu_id as lieu_source into src from titres ti where ti.id = p_depuis;
  if src.niveau is null then
    raise exception 'titres: Titre introuvable.';
  end if;
  if v_nom = '' then
    raise exception 'titres: Le nom est requis.';
  end if;
  -- Un titre du réseau (niveau réseau) n'a pas de centre ; un titre de promo ou de centre sans centre est un titre du réseau.
  v_lieu := case when src.niveau = 'reseau' then null else p_lieu_id end;
  if v_lieu is not null and not exists (select 1 from lieux l where l.id = v_lieu) then
    raise exception 'titres: Le centre est introuvable.';
  end if;
  -- Le titre d'origine ne se lit que depuis son centre ou depuis le réseau.
  if src.lieu_source is not null and src.lieu_source is distinct from v_lieu
     and not (coalesce(geste_centre(src.lieu_source, 'equipe.lire'), false) or coalesce(geste_reseau('directions.lire'), false)) then
    raise exception 'titres: Ce titre appartient à un autre centre.' using errcode = '42501';
  end if;
  v_cases := _cases_effectives(p_depuis);
  v_phrase := _refus_gestion(src.niveau, v_lieu, v_cases);
  if v_phrase is not null then
    raise exception '%', v_phrase using errcode = '42501';
  end if;
  begin
    insert into titres (nom, niveau, lieu_id, cases, cree_par) values (v_nom, src.niveau, v_lieu, v_cases, v_moi) returning id into v_id;
  exception when unique_violation then
    raise exception 'titres: Un titre de ce nom existe déjà ici.';
  end;
  return v_id;
end;
$f$;

create function public.ajuster_titre(p_titre_id bigint, p_lieu_id integer, p_nom text, p_cases jsonb)
returns jsonb
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $f$
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  v_nom text := case when p_nom is null then null else trim(p_nom) end;
  t record;
  v_lieu integer;
  v_phrase text;
  v_version bigint;
  v_cible bigint;
  v_creee boolean := false;
  v_emails text[];
  v_promos integer[];
  v_bascules integer := 0;
  i integer;
begin
  if v_moi is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  select ti.niveau, ti.fixe, ti.nom, ti.lieu_id as lieu_du_titre, coalesce(ti.origine_id, ti.id) as racine into t from titres ti where ti.id = p_titre_id;
  if t.niveau is null then
    raise exception 'titres: Titre introuvable.';
  end if;
  if t.fixe then
    raise exception 'titres: Un titre fixe ne se modifie pas.';
  end if;
  if v_nom = '' then
    raise exception 'titres: Le nom est requis.';
  end if;
  if not coalesce(_cases_valides(t.niveau, p_cases), false) then
    raise exception 'titres: Ces cases ne sont pas valides.';
  end if;
  -- Le centre en jeu : celui du titre ; un titre du réseau (niveau promo ou centre) ajusté depuis un centre y aura sa version.
  if t.lieu_du_titre is not null and p_lieu_id is not null and p_lieu_id <> t.lieu_du_titre then
    raise exception 'titres: Ce titre appartient à un autre centre.';
  end if;
  v_lieu := case when t.niveau = 'reseau' then null else coalesce(t.lieu_du_titre, p_lieu_id) end;
  if v_lieu is not null and not exists (select 1 from lieux l where l.id = v_lieu) then
    raise exception 'titres: Le centre est introuvable.';
  end if;
  -- Jamais sur soi : ni le titre qu'on porte, ni sa version, ni le titre du réseau dont il est la version (le fondateur excepté).
  if not coalesce(est_fondateur(), false) and exists (
       select 1 from affectations af join titres tt on tt.id = af.titre_id
        where lower(af.email) = v_moi and (tt.id = t.racine or tt.origine_id = t.racine)) then
    raise exception 'titres: Vous ne pouvez pas modifier un titre que vous portez.' using errcode = '42501';
  end if;
  v_phrase := _refus_gestion(t.niveau, v_lieu, p_cases);
  if v_phrase is not null then
    raise exception '%', v_phrase using errcode = '42501';
  end if;
  begin
    if t.lieu_du_titre is null and t.niveau in ('promo', 'centre') and v_lieu is not null then
      select ti.id into v_version from titres ti where ti.origine_id = p_titre_id and ti.lieu_id = v_lieu;
      if v_version is null then
        -- La version du centre, avec le même nom ; les personnes de ce centre qui portaient le titre du réseau y passent.
        insert into titres (nom, niveau, lieu_id, origine_id, cases, cree_par)
        values (coalesce(v_nom, t.nom), t.niveau, v_lieu, p_titre_id, p_cases, v_moi) returning id into v_version;
        v_creee := true;
        if t.niveau = 'promo' then
          select array_agg(a.email order by a.promo_id), array_agg(a.promo_id order by a.promo_id) into v_emails, v_promos
            from affectations a join promos p on p.id = a.promo_id
           where a.role = 'formateur' and a.titre_id = p_titre_id and p.lieu_id = v_lieu;
          select count(distinct lower(e)) into v_bascules from unnest(coalesce(v_emails, '{}')) e;
          delete from affectations a using promos p
           where p.id = a.promo_id and a.role = 'formateur' and a.titre_id = p_titre_id and p.lieu_id = v_lieu;
          for i in 1..coalesce(cardinality(v_emails), 0) loop
            insert into affectations (email, role, promo_id, titre_id) values (v_emails[i], 'formateur', v_promos[i], v_version);
          end loop;
        else
          select array_agg(a.email) into v_emails from affectations a
           where a.role = 'direction' and a.titre_id = p_titre_id and a.lieu_id = v_lieu;
          v_bascules := coalesce(cardinality(v_emails), 0);
          delete from affectations a where a.role = 'direction' and a.titre_id = p_titre_id and a.lieu_id = v_lieu;
          for i in 1..coalesce(cardinality(v_emails), 0) loop
            insert into affectations (email, role, lieu_id, titre_id) values (v_emails[i], 'direction', v_lieu, v_version);
          end loop;
        end if;
      else
        update titres set nom = coalesce(v_nom, nom), cases = p_cases, modifie_le = now(), modifie_par = v_moi where id = v_version;
      end if;
      v_cible := v_version;
    else
      update titres set nom = coalesce(v_nom, nom), cases = p_cases, modifie_le = now(), modifie_par = v_moi where id = p_titre_id;
      v_cible := p_titre_id;
    end if;
  exception when unique_violation then
    raise exception 'titres: Un titre de ce nom existe déjà ici.';
  end;
  return jsonb_build_object('titre_id', v_cible, 'version_creee', v_creee, 'porteurs_bascules', v_bascules);
end;
$f$;

create function public.supprimer_titre(p_titre_id bigint)
returns void
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $f$
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  t record;
  v_phrase text;
begin
  if v_moi is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  select ti.niveau, ti.fixe, ti.lieu_id as lieu_du_titre into t from titres ti where ti.id = p_titre_id;
  if t.niveau is null then
    raise exception 'titres: Titre introuvable.';
  end if;
  if t.fixe then
    raise exception 'titres: Un titre fixe ne se supprime pas.';
  end if;
  v_phrase := _refus_gestion(t.niveau, t.lieu_du_titre, _cases_effectives(p_titre_id));
  if v_phrase is not null then
    raise exception '%', v_phrase using errcode = '42501';
  end if;
  if exists (select 1 from affectations a where a.titre_id = p_titre_id) then
    raise exception 'titres: Ce titre est encore porté : retirez-le d''abord.';
  end if;
  delete from titres where id = p_titre_id;
end;
$f$;

revoke all on function public._refus_gestion(text, integer, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.creer_titre(bigint, text, integer) from public, anon, service_role;
grant execute on function public.creer_titre(bigint, text, integer) to authenticated;
revoke all on function public.ajuster_titre(bigint, integer, text, jsonb) from public, anon, service_role;
grant execute on function public.ajuster_titre(bigint, integer, text, jsonb) to authenticated;
revoke all on function public.supprimer_titre(bigint) from public, anon, service_role;
grant execute on function public.supprimer_titre(bigint) to authenticated;

-- D. Les lectures de l'étape 3 (écrans). Lecture seule, security definer, stable, authenticated seul ; un droit manquant lève 42501 avec la
-- phrase des écritures (l'écran la montre telle quelle).
--   titres_visibles(centre)            les titres d'un centre (Équipe au moins sur Voir) ou du réseau (centre nul, Directions de centre au moins
--                                      sur Voir) : cases effectives, nombre de porteurs, et « donnable » (aucun refus de _refus_titre, verrou compris).
--   mes_titres()                       les titres de l'appelant : une ligne par titre et par centre (promos du centre groupées pour un titre de promo).
--   personnes_et_titres(centre, promo) qui porte quoi : pour une promo (Réglages de la promo ou Équipe du centre), pour un centre (Équipe),
--                                      pour le réseau (Directions de centre) ; le réseau ne voit jamais de titre de promo.
--   journal_des_droits(centre)         le journal de la migration 4 (trois ans au plus) ; la table absente, aucune ligne et aucune erreur.
create function public.titres_visibles(p_lieu_id integer)
returns table(id bigint, nom text, niveau text, lieu_id integer, fixe boolean, origine_id bigint, cases jsonb, porteurs integer, donnable boolean)
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
#variable_conflict use_column
begin
  if auth.jwt() ->> 'email' is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  if p_lieu_id is not null then
    if not coalesce(geste_centre(p_lieu_id, 'equipe.lire'), false) then
      raise exception 'titres: Réservé à l''équipe du centre.' using errcode = '42501';
    end if;
    -- Les titres fixes de promo et de centre, ceux du centre, et ceux du réseau de niveau promo ou centre que le centre n'a pas remplacés
    -- par sa version.
    return query
      select t.id, t.nom, t.niveau, t.lieu_id, t.fixe, t.origine_id, _cases_effectives(t.id),
             (select count(distinct lower(a.email))::integer from affectations a
               where a.titre_id = t.id
                 and ((a.role = 'formateur' and a.promo_id in (select p.id from promos p where p.lieu_id = p_lieu_id))
                      or (a.role = 'direction' and a.lieu_id = p_lieu_id))),
             (select r.etat is null from _refus_titre(t.id, p_lieu_id, null, 'donner') r)
        from titres t
       where t.niveau in ('promo', 'centre')
         and (t.fixe or t.lieu_id = p_lieu_id
              or (t.lieu_id is null and not exists (select 1 from titres v where v.origine_id = t.id and v.lieu_id = p_lieu_id)))
       order by case t.niveau when 'promo' then 0 else 1 end, t.fixe desc, t.nom collate "C", t.id;
  else
    if not coalesce(geste_reseau('directions.lire'), false) then
      raise exception 'titres: Réservé au réseau.' using errcode = '42501';
    end if;
    return query
      select t.id, t.nom, t.niveau, t.lieu_id, t.fixe, t.origine_id, _cases_effectives(t.id),
             (select count(distinct lower(a.email))::integer from affectations a where a.titre_id = t.id),
             (select r.etat is null from _refus_titre(t.id, null, null, 'donner') r)
        from titres t
       where t.lieu_id is null
       order by case t.niveau when 'promo' then 0 when 'centre' then 1 else 2 end, t.fixe desc, t.nom collate "C", t.id;
  end if;
end;
$f$;

create function public.mes_titres()
returns table(titre_id bigint, nom text, niveau text, lieu_id integer, lieu_nom text, promo_ids integer[], cases jsonb)
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
#variable_conflict use_column
declare
  v_moi text := lower(auth.jwt() ->> 'email');
begin
  if v_moi is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  return query
    select g.titre_id, t.nom, t.niveau, g.lieu, l.nom, g.promos, _cases_effectives(t.id)
      from (select x.titre_id, x.lieu,
                   case when x.role = 'formateur' then array_agg(x.promo_id order by x.promo_id) end as promos
              from (select a.titre_id, a.role, a.promo_id,
                           case a.role when 'formateur' then (select p.lieu_id from promos p where p.id = a.promo_id)
                                       when 'direction' then a.lieu_id end as lieu
                      from affectations a
                     where lower(a.email) = v_moi) x
             group by x.titre_id, x.role, x.lieu) g
      join titres t on t.id = g.titre_id
      left join lieux l on l.id = g.lieu
     order by case t.niveau when 'promo' then 0 when 'centre' then 1 else 2 end, l.nom collate "C", t.nom collate "C", t.id;
end;
$f$;

create function public.personnes_et_titres(p_lieu_id integer default null, p_promo_id integer default null)
returns table(email text, titre_id bigint, titre_nom text, niveau text, lieu_id integer, promo_ids integer[])
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
#variable_conflict use_column
declare
  v_l integer;
begin
  if auth.jwt() ->> 'email' is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  if p_promo_id is not null then
    -- Une promo : ses titres de promo et les titres de centre de son centre.
    v_l := lieu_de_promo(p_promo_id);
    if v_l is null or not (coalesce(geste_promo(p_promo_id, 'reglages.modifier'), false) or coalesce(geste_centre(v_l, 'equipe.lire'), false)) then
      raise exception 'titres: Réservé à l''équipe du centre.' using errcode = '42501';
    end if;
    return query
      select q.email, q.titre_id, q.titre_nom, q.niveau, q.lieu_id, q.promo_ids
        from (select lower(a.email) as email, t.id as titre_id, t.nom as titre_nom, t.niveau, v_l as lieu_id, array[a.promo_id] as promo_ids
                from affectations a join titres t on t.id = a.titre_id
               where a.role = 'formateur' and a.promo_id = p_promo_id
              union all
              select lower(a.email), t.id, t.nom, t.niveau, v_l, null::integer[]
                from affectations a join titres t on t.id = a.titre_id
               where a.role = 'direction' and a.lieu_id = v_l) q
       order by q.email collate "C", q.niveau, q.titre_nom collate "C";
  elsif p_lieu_id is not null then
    -- Un centre : ses titres de promo (promos groupées) et de centre.
    if not coalesce(geste_centre(p_lieu_id, 'equipe.lire'), false) then
      raise exception 'titres: Réservé à l''équipe du centre.' using errcode = '42501';
    end if;
    return query
      select q.email, q.titre_id, q.titre_nom, q.niveau, q.lieu_id, q.promo_ids
        from (select lower(a.email) as email, t.id as titre_id, t.nom as titre_nom, t.niveau, p_lieu_id as lieu_id,
                     array_agg(a.promo_id order by a.promo_id) as promo_ids
                from affectations a join promos pr on pr.id = a.promo_id join titres t on t.id = a.titre_id
               where a.role = 'formateur' and pr.lieu_id = p_lieu_id
               group by lower(a.email), t.id, t.nom, t.niveau
              union all
              select lower(a.email), t.id, t.nom, t.niveau, p_lieu_id, null::integer[]
                from affectations a join titres t on t.id = a.titre_id
               where a.role = 'direction' and a.lieu_id = p_lieu_id) q
       order by q.email collate "C", q.niveau, q.titre_nom collate "C";
  else
    -- Le réseau : les titres de centre (tous les centres) et du réseau, jamais ceux d'une promo.
    if not coalesce(geste_reseau('directions.lire'), false) then
      raise exception 'titres: Réservé au réseau.' using errcode = '42501';
    end if;
    return query
      select q.email, q.titre_id, q.titre_nom, q.niveau, q.lieu_id, q.promo_ids
        from (select lower(a.email) as email, t.id as titre_id, t.nom as titre_nom, t.niveau, a.lieu_id as lieu_id, null::integer[] as promo_ids
                from affectations a join titres t on t.id = a.titre_id
               where a.role = 'direction'
              union all
              select lower(a.email), t.id, t.nom, t.niveau, null::integer, null::integer[]
                from affectations a join titres t on t.id = a.titre_id
               where a.role = 'siege') q
       order by q.email collate "C", q.niveau, q.titre_nom collate "C";
  end if;
end;
$f$;

create function public.journal_des_droits(p_lieu_id integer default null)
returns table(quand timestamptz, par text, action text, pour text, titre_nom text, niveau text, lieu_id integer, promo_id integer, avant jsonb, apres jsonb)
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
#variable_conflict use_column
begin
  if auth.jwt() ->> 'email' is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  if p_lieu_id is not null then
    if not coalesce(geste_centre(p_lieu_id, 'equipe.lire'), false) then
      raise exception 'titres: Réservé à l''équipe du centre.' using errcode = '42501';
    end if;
  elsif not coalesce(geste_reseau('directions.lire'), false) then
    raise exception 'titres: Réservé au réseau.' using errcode = '42501';
  end if;
  -- La migration 4 (journal) peut ne pas être appliquée : aucune ligne, aucune erreur.
  if to_regclass('public.journal_droits') is null then
    return;
  end if;
  -- Un centre : les lignes de ce centre. Le réseau : les lignes de niveau centre et réseau, jamais celles d'une promo ; le fondateur lit tout.
  return query execute
    'select j.quand, j.par, j.action, j.pour, j.titre_nom, j.niveau, j.lieu_id, j.promo_id, j.avant, j.apres
       from public.journal_droits j
      where j.quand >= now() - interval ''3 years''
        and (($1 is not null and j.lieu_id = $1)
             or ($1 is null and ($2 or j.niveau in (''centre'', ''reseau''))))
      order by j.quand desc, j.id desc'
    using p_lieu_id, coalesce(est_fondateur(), false);
end;
$f$;

revoke all on function public.titres_visibles(integer) from public, anon, service_role;
grant execute on function public.titres_visibles(integer) to authenticated;
revoke all on function public.mes_titres() from public, anon, service_role;
grant execute on function public.mes_titres() to authenticated;
revoke all on function public.personnes_et_titres(integer, integer) from public, anon, service_role;
grant execute on function public.personnes_et_titres(integer, integer) to authenticated;
revoke all on function public.journal_des_droits(integer) from public, anon, service_role;
grant execute on function public.journal_des_droits(integer) to authenticated;
