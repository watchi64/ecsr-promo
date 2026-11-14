-- Titres et droits à la carte, étape 3, migration 7 : correctifs de base décidés par Timy le 12/11 (D1, D4, D5) et restes du rapport de
-- l'étape 2b (M4, M5, M7). Aucun fichier de l'app ne change ; pour les titres fixes, chaque réponse reste celle d'aujourd'hui.
--   A. D1 : _refus_gestion (créer, ajuster, supprimer un titre) réserve au siège fixe et au fondateur la création, l'ajustement et la
--      suppression des titres de centre de niveau centre (avec l'équipe du centre sur Modifier) et des titres du réseau de niveau promo
--      ou centre (le siège fixe seul, phrase « Réservé au siège. » ; étendu à la création d'un titre du réseau de niveau promo par
--      décision de Timy du 14/11). Un titre non fixe « Directions de centre : Modifier » garde le don et le retrait des titres existants
--      (_refus_titre ne change pas) et la gestion des titres du réseau de niveau réseau. La fonction est remplacée en entier, après une
--      garde de dérive (bloc de outils/generer_fragments_titres_7.py : ne pas le modifier à la main).
-- Le retour (20261115_titres_7_correctifs_retour.sql) remet le texte de la migration 6, relu dans son fichier par le même générateur.
-- À appliquer en une seule transaction : psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261115_titres_7_correctifs.sql. Jamais sans
-- l'accord explicite de Timy.
set local lock_timeout = '3s';

-- A. D1 : qui crée, ajuste et supprime les titres -------------------------------------------------------------------------------------
-- debut du bloc genere (outils/generer_fragments_titres_7.py aller)
-- public._refus_gestion(text, integer, jsonb) : garde de dérive (le corps en vigueur est celui qu'on remplace), puis le texte nouveau.
do $garde_refus_gestion$
declare
  v_corps text;
begin
  if to_regprocedure('public._refus_gestion(text, integer, jsonb)') is null then
    raise exception 'titres_7_correctifs : public._refus_gestion(text, integer, jsonb) n''existe pas ; rien n''est changé';
  end if;
  select replace(p.prosrc, E'\r', '') into v_corps from pg_proc p where p.oid = to_regprocedure('public._refus_gestion(text, integer, jsonb)');
  if v_corps is distinct from $attendu$
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
$attendu$ then
    raise exception 'titres_7_correctifs : le corps de public._refus_gestion(text, integer, jsonb) n''est pas celui attendu ; rien n''est changé';
  end if;
end $garde_refus_gestion$;

create or replace function public._refus_gestion(p_niveau text, p_lieu_id integer, p_cases jsonb)
returns text
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $f$
declare
  v_page text;
begin
  -- 1. Le fondateur, hors aperçu : permis.
  if coalesce(est_fondateur(), false) then
    return null;
  end if;
  if p_lieu_id is not null and p_niveau in ('promo', 'centre') then
    if p_niveau = 'promo' then
      -- 2. Titre d'un centre, niveau promo : Équipe sur Modifier dans ce centre.
      if case_centre(p_lieu_id, 'equipe') <> 2 then
        return 'titres: Réservé à l''équipe du centre.';
      end if;
    else
      -- 3. Titre d'un centre, niveau centre : Équipe sur Modifier dans ce centre, ou le siège fixe ; des cases au plus égales à celles de
      --    l'appelant, sauf direction fixe du centre ou siège fixe. Un titre non fixe du réseau (Directions de centre : Modifier) n'y
      --    touche plus : il donne et retire les titres existants, il ne les crée ni ne les ajuste.
      if case_centre(p_lieu_id, 'equipe') <> 2 and not coalesce(siege_fixe(), false) then
        return 'titres: Réservé à l''équipe du centre.';
      end if;
      if not coalesce(direction_fixe(p_lieu_id), false) and not coalesce(siege_fixe(), false) then
        v_page := _depasse(p_cases, _cases_appelant('centre', p_lieu_id));
      end if;
    end if;
  elsif p_niveau in ('promo', 'centre') then
    -- 4. Titre du réseau de niveau promo ou centre (sans centre), créé, ajusté ou supprimé : le siège fixe seul.
    if not coalesce(siege_fixe(), false) then
      return 'titres: Réservé au siège.';
    end if;
  else
    -- 5. Titre du réseau de niveau réseau : Directions de centre sur Modifier ; des cases au plus égales à celles de l'appelant, sauf
    --    siège fixe.
    if case_reseau('directions') <> 2 then
      return 'titres: Réservé au réseau.';
    end if;
    if not coalesce(siege_fixe(), false) then
      v_page := _depasse(p_cases, _cases_appelant('reseau', null));
    end if;
  end if;
  if v_page is not null then
    return 'titres: Ce titre ouvre plus que le vôtre (' || v_page || ').';
  end if;
  return null;
end;
$f$;

revoke all on function public._refus_gestion(text, integer, jsonb) from public, anon, authenticated, service_role;
-- fin du bloc genere
