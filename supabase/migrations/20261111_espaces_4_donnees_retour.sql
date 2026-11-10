-- Marche arrière de 20261111_espaces_4_donnees.sql (lot 5, suite) : remet inviter_compte et regler_affectations_formateur
-- telles que l'étape 2 les a posées (les fragments de la migration, remplacés dans l'autre sens, chacun attendu exactement
-- une fois), puis retire etat_anonymisation_promo(integer), anonymiser_promo(integer), benevoles_a_purger(integer),
-- purger_benevoles(integer[], integer) et _orphelin_en_personnel. Les droits d'exécution des deux fonctions redéfinies ne
-- bougent pas (create or replace les garde). Après ce retour, pg_get_functiondef redonne le texte d'avant, retours chariot
-- compris. Les versions sans argument des fonctions d'anonymisation et de purge n'ont jamais été touchées.
set local lock_timeout = '3s';

do $retour$
declare
  v_fonctions regprocedure[] := array[
    'public.inviter_compte(text, text, integer, integer, integer)'::regprocedure,
    'public.regler_affectations_formateur(text, integer, integer[], integer)'::regprocedure];
  -- La fonction de chaque fragment (rang dans v_fonctions).
  v_de integer[] := array[1, 1, 1, 1, 1, 2, 2, 2];
  v_nouveaux text[] := array[
$nouveau$
  v_aff bigint := 0;
$nouveau$,
$nouveau$
    -- Le profil (et sa fiche formateur, si elle est libre) est créé par la fonction interne, commune avec
    -- regler_affectations_formateur.
    v_n := case when _profil_formateur(v_email, p_prof_id, v_moi) then 1 else 0 end;
$nouveau$,
$nouveau$
    -- Un compte qui a une fiche de stagiaire n'est jamais affecté à la direction.
    if exists (select 1 from user_profiles u where lower(u.email) = v_email and u.stagiaire_id is not null) then
      raise exception 'invitation: Cette adresse est celle d''un compte stagiaire.';
    end if;
$nouveau$,
$nouveau$
    -- Un compte qui a une fiche de stagiaire n'est jamais affecté au siège.
    if exists (select 1 from user_profiles u where lower(u.email) = v_email and u.stagiaire_id is not null) then
      raise exception 'invitation: Cette adresse est celle d''un compte stagiaire.';
    end if;
$nouveau$,
$nouveau$
  return jsonb_build_object('email', v_email, 'role', v_role, 'cree', v_n > 0, 'affecte', v_aff);
$nouveau$,
$nouveau$
  v_cree boolean := false;
$nouveau$,
$nouveau$
  select u.email into v_cible from user_profiles u where lower(u.email) = v_email;
$nouveau$,
$nouveau$
  return jsonb_build_object('email', v_cible, 'cree', v_cree, 'ajoutees', to_jsonb(v_ajoutees), 'retirees', to_jsonb(v_retirees));
$nouveau$];
  v_anciens text[] := array[
$ancien$
  v_aff bigint := 0;
  v_transforme boolean := false;
$ancien$,
$ancien$
    -- Le compte d'un ancien stagiaire (sans fiche) devient un compte du personnel, avec la fiche formateur si elle est libre.
    v_transforme := _orphelin_en_personnel(v_email, true, p_prof_id, v_moi);
    -- Le profil (et sa fiche formateur, si elle est libre) est créé par la fonction interne, commune avec
    -- regler_affectations_formateur.
    v_n := case when _profil_formateur(v_email, p_prof_id, v_moi) then 1 else 0 end;
$ancien$,
$ancien$
    -- Un compte qui a une fiche de stagiaire n'est jamais affecté à la direction.
    if exists (select 1 from user_profiles u where lower(u.email) = v_email and u.stagiaire_id is not null) then
      raise exception 'invitation: Cette adresse est celle d''un compte stagiaire.';
    end if;
    -- Le compte d'un ancien stagiaire (sans fiche) devient un compte du personnel.
    v_transforme := _orphelin_en_personnel(v_email, false, null, v_moi);
$ancien$,
$ancien$
    -- Un compte qui a une fiche de stagiaire n'est jamais affecté au siège.
    if exists (select 1 from user_profiles u where lower(u.email) = v_email and u.stagiaire_id is not null) then
      raise exception 'invitation: Cette adresse est celle d''un compte stagiaire.';
    end if;
    -- Le compte d'un ancien stagiaire (sans fiche) devient un compte du personnel.
    v_transforme := _orphelin_en_personnel(v_email, false, null, v_moi);
$ancien$,
$ancien$
  return jsonb_build_object('email', v_email, 'role', v_role, 'cree', v_n > 0, 'affecte', v_aff, 'transforme', v_transforme);
$ancien$,
$ancien$
  v_cree boolean := false;
  v_transforme boolean := false;
$ancien$,
$ancien$
  -- Le compte d'un ancien stagiaire (sans fiche) devient un compte du personnel, comme dans inviter_compte.
  if cardinality(v_liste) > 0 then
    v_transforme := _orphelin_en_personnel(v_email, true, p_prof_id, v_moi);
  end if;
  select u.email into v_cible from user_profiles u where lower(u.email) = v_email;
$ancien$,
$ancien$
  return jsonb_build_object('email', v_cible, 'cree', v_cree, 'transforme', v_transforme, 'ajoutees', to_jsonb(v_ajoutees), 'retirees', to_jsonb(v_retirees));
$ancien$];
  v_def text;
  v_ancien text;
  v_nouveau text;
  v_dernier jsonb;
  n integer;
begin
  -- Tout est vérifié avant la moindre exécution : un seul fragment manquant ou en double, et rien n'est changé.
  for f in 1..2 loop
    v_def := pg_get_functiondef(v_fonctions[f]);
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
        raise exception 'espaces_4_donnees_retour : le fragment % attendu dans % est présent % fois (une seule attendue) ; rien n''est changé', i, v_fonctions[f]::text, n;
      end if;
      v_def := replace(v_def, v_ancien, v_nouveau);
    end loop;
    execute v_def;
  end loop;
end
$retour$;

drop function if exists public.purger_benevoles(integer[], integer);
drop function if exists public.benevoles_a_purger(integer);
drop function if exists public.anonymiser_promo(integer);
drop function if exists public.etat_anonymisation_promo(integer);
drop function if exists public._orphelin_en_personnel(text, boolean, integer, text);
