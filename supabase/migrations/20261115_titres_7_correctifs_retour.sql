-- Marche arrière de 20261115_titres_7_correctifs.sql : défait les parties dans l'ordre inverse. Après ce retour, la base est dans l'état
-- d'avant la migration (empreinte des règles, des fonctions et des droits identique).
-- À appliquer en une seule transaction : psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261115_titres_7_correctifs_retour.sql.
set local lock_timeout = '3s';

-- A. _refus_gestion retrouve le texte de la migration 6 (bloc de outils/generer_fragments_titres_7.py retour).
-- debut du bloc genere (outils/generer_fragments_titres_7.py retour)
-- public._refus_gestion(text, integer, jsonb) : garde de dérive (le corps en vigueur est celui qu'on remplace), puis le texte de la migration 6.
do $garde_refus_gestion$
declare
  v_corps text;
begin
  if to_regprocedure('public._refus_gestion(text, integer, jsonb)') is null then
    raise exception 'titres_7_correctifs_retour : public._refus_gestion(text, integer, jsonb) n''existe pas ; rien n''est changé';
  end if;
  select replace(p.prosrc, E'\r', '') into v_corps from pg_proc p where p.oid = to_regprocedure('public._refus_gestion(text, integer, jsonb)');
  if v_corps is distinct from $attendu$
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
$attendu$ then
    raise exception 'titres_7_correctifs_retour : le corps de public._refus_gestion(text, integer, jsonb) n''est pas celui attendu ; rien n''est changé';
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

revoke all on function public._refus_gestion(text, integer, jsonb) from public, anon, authenticated, service_role;
-- fin du bloc genere
