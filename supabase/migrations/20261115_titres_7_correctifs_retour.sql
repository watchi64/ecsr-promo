-- Marche arrière de 20261115_titres_7_correctifs.sql : défait les parties dans l'ordre inverse. Après ce retour, la base est dans l'état
-- d'avant la migration (empreinte des règles, des fonctions et des droits identique).
-- À appliquer en une seule transaction : psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261115_titres_7_correctifs_retour.sql.
set local lock_timeout = '3s';

-- D5 (décision de Timy du 12/11) : tant qu'une personne porte un titre non fixe, le retour s'arrête ici, avant tout changement (les
-- fonctions d'avant la migration ne savent pas le retirer correctement). Retirer d'abord ces titres depuis l'app.
do $garde_d5$
declare
  v_n integer;
begin
  -- Verrou partagé tenu jusqu'à la fin de la transaction : aucun don ni retrait ne passe entre le compte et la fin du retour.
  lock table public.affectations in share mode;
  select count(*) into v_n from public.affectations a join public.titres t on t.id = a.titre_id where not t.fixe;
  if v_n > 0 then
    raise exception 'titres_7_correctifs_retour : % affectation(s) portent un titre non fixe ; les retirer d''abord (page Équipe ou Directions de centre) ; rien n''est changé', v_n;
  end if;
end $garde_d5$;

-- B. D4 : l'index part d'abord ; puis, dans le bloc généré, ajuster_titre et donner_titre perdent leurs verrous, et (C) donner_titre,
-- creer_titre et ajuster_titre les refus M4 et M7 et la règle M5 (fragments inverses).
drop index public.titres_version_unique;

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

do $migration$
declare
  v_fonctions text[] := array[
    'public.ajuster_titre(bigint, integer, text, jsonb)',
    'public.donner_titre(text, bigint, integer, integer[], integer)',
    'public.creer_titre(bigint, text, integer)'];
  -- La fonction de chaque fragment (rang dans v_fonctions).
  v_de integer[] := array[1, 1, 1, 1, 2, 2, 2, 2, 3];
  v_anciens text[] := array[
$ancien$  v_bascules integer := 0;
  v_contrainte text;
$ancien$,
$ancien$  -- D4 : un seul ajustement à la fois par titre ; le second attend, puis voit la version que le premier a créée.
  perform 1 from titres where id = p_titre_id for update;
  if t.lieu_du_titre is null and t.niveau in ('promo', 'centre') and v_lieu is not null then
    select ti.id into v_version$ancien$,
$ancien$  exception when unique_violation then
    -- D4 : la version du centre posée entre-temps par un autre chemin (index titres_version_unique) n'est pas un nom en double.
    get stacked diagnostics v_contrainte = constraint_name;
    if v_contrainte = 'titres_version_unique' then
      raise exception 'titres: Ce titre vient d''être ajusté pour ce centre par une autre personne : rouvrez-le, puis réessayez.';
    end if;
    raise exception 'titres: Un titre de ce nom existe déjà ici.';
  end;
  return jsonb_build_object($ancien$,
$ancien$  v_phrase := _refus_gestion(t.niveau, v_lieu, _cases_effectives(coalesce(v_version, p_titre_id)));
  if v_phrase is not null then
    raise exception '%', v_phrase using errcode = '42501';
  end if;
  -- M7 : un nom nouveau ne reprend pas celui d'un titre de l'autre portée. Le nom se pose dans un centre (titre de centre, ou version d'un
  -- titre du réseau) : aucun titre du réseau non fixe ne le porte ; au réseau : aucun titre créé par un centre. Le titre lui-même, sa racine
  -- et ses versions sont écartés (une version garde le nom de son titre du réseau).
  if v_nom is not null then
    if v_lieu is not null then
      if exists (select 1 from titres r where r.lieu_id is null and not r.fixe and lower(r.nom) = lower(v_nom)
                    and coalesce(r.origine_id, r.id) <> t.racine) then
        raise exception 'titres: Un titre du réseau porte déjà ce nom : choisissez-en un autre.';
      end if;
    elsif exists (select 1 from titres c where c.lieu_id is not null and c.origine_id is null and lower(c.nom) = lower(v_nom)
                     and coalesce(c.origine_id, c.id) <> t.racine) then
      raise exception 'titres: Un centre a déjà un titre de ce nom : choisissez-en un autre.';
    end if;
  end if;
$ancien$,
$ancien$  -- D4 : un don attend l'ajustement en cours du même titre (et inversement), puis voit sa version.
  perform 1 from titres where id = p_titre_id for share;
  select v.id into v_ancien from titres r join titres v on v.origine_id = r.id and v.lieu_id = p_lieu_id$ancien$,
$ancien$  select ti.niveau, ti.fixe into t from titres ti where ti.id = v_titre_id;
  -- M4 : une fiche formateur ne se relie qu'au titre fixe Formateur.
  if p_prof_id is not null and not (t.niveau = 'promo' and t.fixe) then
    raise exception 'titres: Une fiche formateur ne se relie qu''au titre Formateur.';
  end if;
$ancien$,
$ancien$  -- M4, M5 : seul le titre fixe Formateur fait un compte de formateur (is_admin vrai, fiche reliée).
  v_transforme := _orphelin_en_personnel(v_email, t.niveau = 'promo' and t.fixe, case when t.niveau = 'promo' and t.fixe then p_prof_id end, v_moi);$ancien$,
$ancien$    if t.niveau = 'promo' and t.fixe then
      v_cree := _profil_formateur($ancien$,
$ancien$  -- M7 : un nom ne reprend pas celui d'un titre de l'autre portée (après le droit : un appelant sans droit n'apprend pas qu'un nom
  -- existe). Un titre de centre : aucun titre du réseau non fixe ne porte ce nom ; un titre du réseau : aucun titre créé par un centre.
  if v_lieu is not null then
    if exists (select 1 from titres r where r.lieu_id is null and not r.fixe and lower(r.nom) = lower(v_nom)) then
      raise exception 'titres: Un titre du réseau porte déjà ce nom : choisissez-en un autre.';
    end if;
  elsif exists (select 1 from titres c where c.lieu_id is not null and c.origine_id is null and lower(c.nom) = lower(v_nom)) then
    raise exception 'titres: Un centre a déjà un titre de ce nom : choisissez-en un autre.';
  end if;
  begin
    insert into titres (nom, niveau, lieu_id, cases, cree_par)$ancien$];
  v_nouveaux text[] := array[
$nouveau$  v_bascules integer := 0;
$nouveau$,
$nouveau$  if t.lieu_du_titre is null and t.niveau in ('promo', 'centre') and v_lieu is not null then
    select ti.id into v_version$nouveau$,
$nouveau$  exception when unique_violation then
    raise exception 'titres: Un titre de ce nom existe déjà ici.';
  end;
  return jsonb_build_object($nouveau$,
$nouveau$  v_phrase := _refus_gestion(t.niveau, v_lieu, _cases_effectives(coalesce(v_version, p_titre_id)));
  if v_phrase is not null then
    raise exception '%', v_phrase using errcode = '42501';
  end if;
$nouveau$,
$nouveau$  select v.id into v_ancien from titres r join titres v on v.origine_id = r.id and v.lieu_id = p_lieu_id$nouveau$,
$nouveau$  select ti.niveau, ti.fixe into t from titres ti where ti.id = v_titre_id;
$nouveau$,
$nouveau$  v_transforme := _orphelin_en_personnel(v_email, t.niveau = 'promo', case when t.niveau = 'promo' then p_prof_id end, v_moi);$nouveau$,
$nouveau$    if t.niveau = 'promo' then
      v_cree := _profil_formateur($nouveau$,
$nouveau$  begin
    insert into titres (nom, niveau, lieu_id, cases, cree_par)$nouveau$];
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
      raise exception 'titres_7_correctifs_retour : % n''existe pas ; rien n''est changé', v_fonctions[f];
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
        raise exception 'titres_7_correctifs_retour : le fragment % attendu dans % est présent % fois (une seule attendue) ; rien n''est changé', i, v_fonctions[f], n;
      end if;
      v_def := replace(v_def, v_ancien, v_nouveau);
    end loop;
    execute v_def;
  end loop;
end
$migration$;
-- fin du bloc genere
