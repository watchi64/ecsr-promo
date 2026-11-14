-- Titres et droits à la carte, étape 3, migration 7 : correctifs de base décidés par Timy le 12/11 (D1, D4, D5) et restes du rapport de
-- l'étape 2b (M4, M5, M7). Aucun fichier de l'app ne change ; pour les titres fixes, chaque réponse reste celle d'aujourd'hui.
--   A. D1 : _refus_gestion (créer, ajuster, supprimer un titre) réserve au siège fixe et au fondateur la création, l'ajustement et la
--      suppression des titres de centre de niveau centre (avec l'équipe du centre sur Modifier) et des titres du réseau de niveau promo
--      ou centre (le siège fixe seul, phrase « Réservé au siège. » ; étendu à la création d'un titre du réseau de niveau promo par
--      décision de Timy du 14/11). Un titre non fixe « Directions de centre : Modifier » garde le don et le retrait des titres existants
--      (_refus_titre ne change pas) et la gestion des titres du réseau de niveau réseau. La fonction est remplacée en entier, après une
--      garde de dérive (bloc de outils/generer_fragments_titres_7.py : ne pas le modifier à la main).
--   B. D4 : un centre n'a qu'une version d'un titre du réseau. L'index unique partiel titres_version_unique (origine_id, lieu_id) en est
--      la garantie, pour tout chemin (après une garde : aucune paire déjà en double). ajuster_titre prend un verrou de ligne sur le titre
--      avant de chercher sa version : un second ajustement simultané attend, voit la version et la modifie ; si l'index se déclenche
--      quand même, la phrase le dit (« Ce titre vient d'être ajusté pour ce centre par une autre personne »). donner_titre prend un
--      verrou partagé sur le même titre : un don et un ajustement simultanés s'attendent, le porteur finit sur la version du centre.
--      Fonctions modifiées par fragments, dans le même bloc généré.
-- Le retour (20261115_titres_7_correctifs_retour.sql) remet le texte de la migration 6, relu dans son fichier par le même générateur, et
-- retire l'index.
-- À appliquer en une seule transaction : psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261115_titres_7_correctifs.sql. Jamais sans
-- l'accord explicite de Timy.
set local lock_timeout = '3s';

-- A. D1 : qui crée, ajuste et supprime les titres ; B. D4 : les verrous d'ajuster_titre et de donner_titre (bloc généré) ---------------
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

do $migration$
declare
  v_fonctions text[] := array[
    'public.ajuster_titre(bigint, integer, text, jsonb)',
    'public.donner_titre(text, bigint, integer, integer[], integer)'];
  -- La fonction de chaque fragment (rang dans v_fonctions).
  v_de integer[] := array[1, 1, 1, 2];
  v_anciens text[] := array[
$ancien$  v_bascules integer := 0;
$ancien$,
$ancien$  if t.lieu_du_titre is null and t.niveau in ('promo', 'centre') and v_lieu is not null then
    select ti.id into v_version$ancien$,
$ancien$  exception when unique_violation then
    raise exception 'titres: Un titre de ce nom existe déjà ici.';
  end;
  return jsonb_build_object($ancien$,
$ancien$  select v.id into v_ancien from titres r join titres v on v.origine_id = r.id and v.lieu_id = p_lieu_id$ancien$];
  v_nouveaux text[] := array[
$nouveau$  v_bascules integer := 0;
  v_contrainte text;
$nouveau$,
$nouveau$  -- D4 : un seul ajustement à la fois par titre ; le second attend, puis voit la version que le premier a créée.
  perform 1 from titres where id = p_titre_id for update;
  if t.lieu_du_titre is null and t.niveau in ('promo', 'centre') and v_lieu is not null then
    select ti.id into v_version$nouveau$,
$nouveau$  exception when unique_violation then
    -- D4 : la version du centre posée entre-temps par un autre chemin (index titres_version_unique) n'est pas un nom en double.
    get stacked diagnostics v_contrainte = constraint_name;
    if v_contrainte = 'titres_version_unique' then
      raise exception 'titres: Ce titre vient d''être ajusté pour ce centre par une autre personne : rouvrez-le, puis réessayez.';
    end if;
    raise exception 'titres: Un titre de ce nom existe déjà ici.';
  end;
  return jsonb_build_object($nouveau$,
$nouveau$  -- D4 : un don attend l'ajustement en cours du même titre (et inversement), puis voit sa version.
  perform 1 from titres where id = p_titre_id for share;
  select v.id into v_ancien from titres r join titres v on v.origine_id = r.id and v.lieu_id = p_lieu_id$nouveau$];
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
      raise exception 'titres_7_correctifs : % n''existe pas ; rien n''est changé', v_fonctions[f];
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
        raise exception 'titres_7_correctifs : le fragment % attendu dans % est présent % fois (une seule attendue) ; rien n''est changé', i, v_fonctions[f], n;
      end if;
      v_def := replace(v_def, v_ancien, v_nouveau);
    end loop;
    execute v_def;
  end loop;
end
$migration$;
-- fin du bloc genere

-- B. D4 : l'index, garantie d'une seule version par centre ---------------------------------------------------------------------------
do $garde_versions$
declare
  v_n integer;
begin
  select count(*) into v_n from (
    select origine_id, lieu_id from public.titres where origine_id is not null group by origine_id, lieu_id having count(*) > 1) d;
  if v_n > 0 then
    raise exception 'titres_7_correctifs : % titre(s) du réseau ont plus d''une version dans un même centre ; rien n''est changé', v_n;
  end if;
end $garde_versions$;

create unique index titres_version_unique on public.titres (origine_id, lieu_id) where origine_id is not null;
