-- Marche arrière de 20261112_titres_6_gestion.sql : défait les parties dans l'ordre inverse (D, C, B, A). Après ce retour, la base est dans
-- l'état d'avant la migration (empreinte des règles, des fonctions et des droits identique). Les titres non fixes, leur verrou et les
-- versions de centre créés entre-temps ne sont pas défaits : la ligne du verrou est effacée, les titres restent (une table que la
-- migration 1 a créée) ; seul le retour 1 les efface.
set local lock_timeout = '3s';

-- D. Les quatre lectures disparaissent.
drop function if exists public.journal_des_droits(integer);
drop function if exists public.personnes_et_titres(integer, integer);
drop function if exists public.mes_titres();
drop function if exists public.titres_visibles(integer);

-- C. Les fonctions de gestion disparaissent et la contrainte titres_centre_requis revient. Garde : aucun titre non fixe de promo ou de
-- centre sans centre ne doit exister (la contrainte les refuserait) ; sinon le retour s'arrête sans rien changer (supprimer ces titres d'abord).
do $garde_c$
begin
  if exists (select 1 from public.titres t where not t.fixe and t.niveau <> 'reseau' and t.lieu_id is null) then
    raise exception 'titres_6_gestion_retour : des titres du réseau (niveau promo ou centre, sans centre) existent ; les supprimer d''abord ; rien n''est changé';
  end if;
end $garde_c$;

drop function if exists public.supprimer_titre(bigint);
drop function if exists public.ajuster_titre(bigint, integer, text, jsonb);
drop function if exists public.creer_titre(bigint, text, integer);
drop function if exists public._refus_gestion(text, integer, jsonb);
alter table public.titres add constraint titres_centre_requis check (fixe or niveau = 'reseau' or lieu_id is not null);

-- B. donner_titre disparaît et retirer_titre retrouve le texte de la migration 5 (bloc de outils/generer_fragments_titres_6.py retour, à jouer
-- avant la partie A : le texte de la migration 5 appelle encore _refus_titre jusque-là). Le retour 5 refuse de se jouer tant que donner_titre existe.
do $migration$
declare
  v_fonctions text[] := array[
    'public.retirer_titre(text, bigint, integer)',
    'public.regler_affectations_formateur(text, integer, integer[], integer)'];
  -- La fonction de chaque fragment (rang dans v_fonctions).
  v_de integer[] := array[1, 1, 2, 2];
  v_anciens text[] := array[
$ancien$  v_n integer;
  v_etat text;
  v_phrase text;
begin
  if v_moi is null then
$ancien$,
$ancien$  -- Un titre du réseau ne porte sur aucun centre : le centre donné est ignoré.
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
$ancien$,
$ancien$  v_retirees integer[];
  v_titre record;
  v_etat text;
  v_phrase text;
begin
$ancien$,
$ancien$  -- Retirer des promos obéit aux mêmes règles que retirer_titre (_refus_titre) : on ne retire que ce qu'on pourrait donner.
  for v_titre in
    select distinct a.titre_id as id from affectations a
     where lower(a.email) = lower(v_cible) and a.role = 'formateur'
       and a.promo_id in (select p.id from promos p where p.lieu_id = p_lieu_id)
       and not (a.promo_id = any (v_liste))
  loop
    select r.etat, r.phrase into v_etat, v_phrase from _refus_titre(v_titre.id, p_lieu_id, v_cible, 'retirer') r;
    if v_etat is not null then
      raise exception '%', v_phrase using errcode = v_etat;
    end if;
  end loop;
  with retire as (
$ancien$];
  v_nouveaux text[] := array[
$nouveau$  v_n integer;
begin
  if v_moi is null then
$nouveau$,
$nouveau$  -- Les titres non fixes se retireront à la migration 6 (cette ligne seule est alors remplacée).
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
$nouveau$,
$nouveau$  v_retirees integer[];
begin
$nouveau$,
$nouveau$  with retire as (
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
      raise exception 'titres_6_gestion_retour : % n''existe pas ; rien n''est changé', v_fonctions[f];
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
        raise exception 'titres_6_gestion_retour : le fragment % attendu dans % est présent % fois (une seule attendue) ; rien n''est changé', i, v_fonctions[f], n;
      end if;
      v_def := replace(v_def, v_ancien, v_nouveau);
    end loop;
    execute v_def;
  end loop;
end
$migration$;
drop function if exists public.donner_titre(text, bigint, integer, integer[], integer);

-- A. Le verrou et les aides de décision : les fonctions disparaissent, la ligne du verrou est effacée (la contrainte d'avant ne
-- l'admettrait plus) et la contrainte des réglages globaux est celle de 20261108_espaces_3_habillage.sql.
drop function if exists public._refus_titre(bigint, integer, text, text);
drop function if exists public._cases_appelant(text, integer);
drop function if exists public._depasse(jsonb, jsonb);
drop function if exists public._cases_effectives(bigint);
drop function if exists public.regler_titres_ouverts(boolean);
drop function if exists public.titres_ouverts();
delete from public.settings where promo_id is null and key = 'titres_ouverts';
alter table public.settings drop constraint if exists settings_globaux_prevus;
alter table public.settings add constraint settings_globaux_prevus
  check (promo_id is not null or key in ('chatbot_quota_jour', 'cohort_name', 'password_hash', 'habillage_reseau'));
