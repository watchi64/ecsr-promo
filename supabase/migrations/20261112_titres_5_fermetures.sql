-- Titres et droits à la carte, étape 2a (sécurité), migration 5 : les fermetures. Aucun titre non fixe n'est donnable à ce stade : pour les
-- titres fixes (Formateur, Direction de centre, Siège), chaque réponse reste celle d'aujourd'hui, à une exception près (l'écriture directe
-- sur la table des affectations est fermée, partie B).
--   A. retirer_titre(p_email, p_titre_id, p_lieu_id) : retire un titre FIXE. Ordre des contrôles : jeton, titre (absent, non fixe),
--      centre (niveaux promo et centre), droit (Formateur : direction du centre ; Direction de centre : siège ; Siège : fondateur),
--      « jamais sur soi » (sauf le Formateur de la directrice qui forme, et le fondateur), effet (aucune ligne : refus). Les titres non fixes
--      se retireront à la migration 6 (un fragment remplacera la ligne de refus « ne se retire pas encore ici »).
--      inviter_compte : personne ne se nomme soi-même à la direction (le fondateur, hors aperçu, excepté) ; un seul fragment.
-- Les fonctions existantes se réécrivent par fragments (texte d'origine trouvé exactement une fois, sinon la migration s'arrête sans rien
-- changer ; les retours chariot d'une définition posée depuis un fichier Windows sont suivis) : mêmes paramètres, même retour, mêmes
-- phrases de refus, mêmes droits d'exécution. Le retour (20261112_titres_5_fermetures_retour.sql) remet les textes d'origine.
-- Le bloc de fragments vient de outils/generer_fragments_titres_5.py (aller) : ne pas le modifier à la main.
set local lock_timeout = '3s';

-- A. retirer_titre ------------------------------------------------------------------------------------------------------------
create function public.retirer_titre(p_email text, p_titre_id bigint, p_lieu_id integer)
returns jsonb
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $f$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_moi text := lower(auth.jwt() ->> 'email');
  v_niveau text;
  v_fixe boolean;
  v_lieu integer := p_lieu_id;
  v_n integer;
begin
  if v_moi is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  select t.niveau, t.fixe into v_niveau, v_fixe from titres t where t.id = p_titre_id;
  if v_niveau is null then
    raise exception 'titres: Titre introuvable.';
  end if;
  -- Les titres non fixes se retireront à la migration 6 (cette ligne seule est alors remplacée).
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
  -- Jamais sur soi : la directrice qui forme retire son propre Formateur, le fondateur (hors aperçu) retire ce qu'il veut.
  if v_email = v_moi and v_niveau <> 'promo' and not est_fondateur() then
    raise exception 'titres: Vous ne pouvez pas retirer votre propre titre.' using errcode = '42501';
  end if;
  -- L'effet : les lignes de l'adresse (casse ignorée) qui portent ce titre, sur les promos du centre, sur le centre ou sans portée.
  if v_niveau = 'promo' then
    delete from affectations a
     where lower(a.email) = v_email and a.role = 'formateur' and a.titre_id = p_titre_id
       and a.promo_id in (select p.id from promos p where p.lieu_id = v_lieu);
  elsif v_niveau = 'centre' then
    delete from affectations a
     where lower(a.email) = v_email and a.role = 'direction' and a.titre_id = p_titre_id and a.lieu_id = v_lieu;
  else
    delete from affectations a
     where lower(a.email) = v_email and a.role = 'siege' and a.titre_id = p_titre_id;
  end if;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'titres: Cette personne n''a pas ce titre ici.';
  end if;
  return jsonb_build_object('email', v_email, 'titre_id', p_titre_id, 'lieu_id', v_lieu, 'retirees', v_n);
end;
$f$;

revoke all on function public.retirer_titre(text, bigint, integer) from public, anon, service_role;
grant execute on function public.retirer_titre(text, bigint, integer) to authenticated;

-- inviter_compte : personne ne se nomme soi-même à la direction (un fragment, voir le générateur).
do $migration$
declare
  v_fonctions text[] := array[
    'public.inviter_compte(text, text, integer, integer, integer)'];
  -- La fonction de chaque fragment (rang dans v_fonctions).
  v_de integer[] := array[1];
  v_anciens text[] := array[
$ancien$    -- Un compte qui a une fiche de stagiaire n'est jamais affecté à la direction.
$ancien$];
  v_nouveaux text[] := array[
$nouveau$    -- Personne ne se nomme soi-même à la direction (le fondateur, hors aperçu, excepté).
    if v_email = v_moi and not est_fondateur() then
      raise exception 'invitation: Vous ne pouvez pas vous nommer vous-même à la direction.' using errcode = '42501';
    end if;
    -- Un compte qui a une fiche de stagiaire n'est jamais affecté à la direction.
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
      raise exception 'titres_5_fermetures : % n''existe pas ; rien n''est changé', v_fonctions[f];
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
        raise exception 'titres_5_fermetures : le fragment % attendu dans % est présent % fois (une seule attendue) ; rien n''est changé', i, v_fonctions[f], n;
      end if;
      v_def := replace(v_def, v_ancien, v_nouveau);
    end loop;
    execute v_def;
  end loop;
end
$migration$;
