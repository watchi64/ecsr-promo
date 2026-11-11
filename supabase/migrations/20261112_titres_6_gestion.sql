-- Titres et droits à la carte, étape 2b (gestion), migration 6. Aucun fichier de l'app ne change, rien ne se voit : le verrou des titres
-- non fixes reste fermé (aucun titre non fixe n'est donnable) jusqu'à ce que le fondateur le lève (étape 4). Pour les titres fixes,
-- chaque réponse reste celle d'aujourd'hui.
--   A. Le verrou et les aides de décision : la clé globale « titres_ouverts » des réglages (titres_ouverts(), regler_titres_ouverts),
--      _cases_effectives (les cases d'un titre, un titre fixe au plafond de chaque page), _depasse (la première page où un jeu de cases
--      ouvre plus qu'un autre), _cases_appelant (les cases de l'appelant à un niveau) et _refus_titre : les six règles du § 7 de la spec
--      en une seule aide, partagée par donner et retirer.
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
