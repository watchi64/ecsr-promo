-- Marche arrière de 20261112_titres_2_gestes.sql : d'abord la partie B (remet, par les mêmes fragments pris à l'envers, les 29 fonctions de
-- l'app au texte d'avant, chacun attendu exactement une fois), puis la partie A (retire les fonctions des cases et des gestes, que plus
-- rien ne cite). La migration 3 et ses règles sont retirées avant celle-ci.
-- Une fonction absente (retirée par Qualiopi Q5) est sautée sans erreur.
set local lock_timeout = '3s';

do $migration$
declare
  v_fonctions text[] := array[
    'public.a_une_affectation(text)',
    'public.accepter_brouillon_ia(bigint, text, text, text, jsonb)',
    'public.rejeter_brouillon_ia(bigint)',
    'public.anonymiser_promo()',
    'public.etat_anonymisation_promo()',
    'public.anonymiser_stagiaire(integer)',
    'public.anonymiser_promo(integer)',
    'public.etat_anonymisation_promo(integer)',
    'public.benevoles_a_purger()',
    'public.benevoles_a_purger(integer)',
    'public.purger_benevoles(integer[])',
    'public.purger_benevoles(integer[], integer)',
    'public.venues_benevoles()',
    'public.notes_stagiaires_visibles()',
    'public.epcf_moyennes(text)',
    'public.notes_stats_groupe()',
    'public.set_date_naissance(integer, date)',
    'public.emargement_feuille(bigint, boolean)',
    'public.emargement_ouvrir(text, text, text)',
    'public.emargement_signer(bigint, integer, text)',
    'public.is_admin()',
    'public.is_prof()',
    'public.creer_promo(integer, text, date, date)',
    'public.modifier_dates_promo(integer, date, date)',
    'public.regler_habillage_centre(integer, text, boolean)',
    'public.regler_habillage_reseau(text)',
    'public.creer_centre(text)',
    'public.regler_affectations_formateur(text, integer, integer[], integer)',
    'public.inviter_compte(text, text, integer, integer, integer)',
    'public.fiches_effacees_sur_demande(integer[])'];
  -- La fonction de chaque fragment (rang dans v_fonctions).
  v_de integer[] := array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 29, 29, 30];
  v_anciens text[] := array[
$ancien$(select public.geste_promo(promo_courante(), 'stagiaires.gerer'))$ancien$,
$ancien$if not geste_promo(promo_courante(), 'contenus.traiter') then$ancien$,
$ancien$if not geste_promo(promo_courante(), 'contenus.traiter') then$ancien$,
$ancien$if not geste_promo(promo_courante(), 'anonymiser') then$ancien$,
$ancien$if not geste_promo(promo_courante(), 'anonymiser') then$ancien$,
$ancien$if not geste_promo(promo_courante(), 'anonymiser') then$ancien$,
$ancien$if not geste_promo(p_promo, 'anonymiser') then$ancien$,
$ancien$if not geste_promo(p_promo, 'anonymiser') then$ancien$,
$ancien$where (select public.geste_promo(promo_courante(), 'benevoles.purger'))$ancien$,
$ancien$if not geste_centre(p_lieu, 'donnees.purger') then$ancien$,
$ancien$if not geste_promo(promo_courante(), 'benevoles.purger') then$ancien$,
$ancien$if not geste_centre(p_lieu, 'donnees.purger') then$ancien$,
$ancien$where (select public.geste_promo(promo_courante(), 'benevoles.lire'))$ancien$,
$ancien$       (select public.geste_promo(promo_courante(), 'notes.lire'))
$ancien$,
$ancien$(select public.geste_promo(promo_courante(), 'notes.lire'))$ancien$,
$ancien$  select case when membre_stagiaire(promo_courante()) or geste_promo(promo_courante(), 'notes.lire') then jsonb_build_object(
    'n_lignes'$ancien$,
$ancien$(select min(moy) from par_stagiaire)
  ) end;
$ancien$,
$ancien$if not (geste_promo(promo_courante(), 'stagiaires.gerer') or coalesce(p_stagiaire_id = my_stagiaire_id(), false)) then$ancien$,
$ancien$if p_formateur and not geste_promo(promo_courante(), 'emargement.tenir') then$ancien$,
$ancien$if not geste_promo(promo_courante(), 'emargement.tenir') then$ancien$,
$ancien$elsif geste_promo(promo_courante(), 'emargement.tenir') then$ancien$,
$ancien$select geste_promo(promo_courante(), 'contenus.traiter');$ancien$,
$ancien$select geste_promo(promo_courante(), 'contenus.traiter');$ancien$,
$ancien$or not geste_centre(p_lieu_id, 'promos.gerer') then$ancien$,
$ancien$or not geste_centre(lieu_de_promo(p_promo_id), 'promos.gerer') then$ancien$,
$ancien$or not geste_centre(p_lieu_id, 'reglages.modifier') then$ancien$,
$ancien$or not geste_reseau('reglages.modifier') then$ancien$,
$ancien$if not coalesce((select geste_reseau('centres.creer')), false) then$ancien$,
$ancien$or not geste_centre(p_lieu_id, 'formateurs.nommer') then$ancien$,
$ancien$if v_promo_fiche is null or not geste_promo(v_promo_fiche, 'stagiaires.gerer') then$ancien$,
$ancien$if v_promo is null or not geste_centre(lieu_de_promo(v_promo), 'formateurs.nommer') then$ancien$,
$ancien$    if not geste_reseau('directions.nommer') then
$ancien$,
$ancien$(est_fondateur() or geste_promo(s.promo_id, 'stagiaires.lire'))$ancien$];
  v_nouveaux text[] := array[
$nouveau$(select public.equipe_courante())$nouveau$,
$nouveau$if not formateur_courant() then$nouveau$,
$nouveau$if not formateur_courant() then$nouveau$,
$nouveau$if not equipe_courante() then$nouveau$,
$nouveau$if not equipe_courante() then$nouveau$,
$nouveau$if not equipe_courante() then$nouveau$,
$nouveau$if not (coalesce(est_formateur(p_promo), false) or coalesce(est_direction(lieu_de_promo(p_promo)), false)) then$nouveau$,
$nouveau$if not (coalesce(est_formateur(p_promo), false) or coalesce(est_direction(lieu_de_promo(p_promo)), false)) then$nouveau$,
$nouveau$where formateur_courant()$nouveau$,
$nouveau$if not coalesce(est_direction(p_lieu), false) then$nouveau$,
$nouveau$if not formateur_courant() then$nouveau$,
$nouveau$if not coalesce(est_direction(p_lieu), false) then$nouveau$,
$nouveau$where equipe_courante()$nouveau$,
$nouveau$       equipe_courante()
$nouveau$,
$nouveau$(select public.equipe_courante())$nouveau$,
$nouveau$  select jsonb_build_object(
    'n_lignes'$nouveau$,
$nouveau$(select min(moy) from par_stagiaire)
  );
$nouveau$,
$nouveau$if not (equipe_courante() or p_stagiaire_id = my_stagiaire_id()) then$nouveau$,
$nouveau$if p_formateur and not formateur_courant() then$nouveau$,
$nouveau$if not formateur_courant() then$nouveau$,
$nouveau$elsif formateur_courant() then$nouveau$,
$nouveau$select formateur_courant();$nouveau$,
$nouveau$select formateur_courant();$nouveau$,
$nouveau$or not est_direction(p_lieu_id) then$nouveau$,
$nouveau$or not est_direction(lieu_de_promo(p_promo_id)) then$nouveau$,
$nouveau$or not coalesce(est_direction(p_lieu_id), false) then$nouveau$,
$nouveau$or not coalesce(est_siege(), false) then$nouveau$,
$nouveau$if not coalesce((select est_siege()), false) then$nouveau$,
$nouveau$or not coalesce(est_direction(p_lieu_id), false) then$nouveau$,
$nouveau$if v_promo_fiche is null or not (est_formateur(v_promo_fiche) or est_direction(lieu_de_promo(v_promo_fiche))) then$nouveau$,
$nouveau$if v_promo is null or not est_direction(lieu_de_promo(v_promo)) then$nouveau$,
$nouveau$    if not est_siege() then
$nouveau$,
$nouveau$(est_fondateur() or est_formateur(s.promo_id) or est_direction(lieu_de_promo(s.promo_id)))$nouveau$];
  f integer;
  i integer;
  v_oid regprocedure;
  v_def text;
  v_ancien text;
  v_nouveau text;
  n integer;
begin
  -- Le bloc est atomique : un seul fragment manquant ou en double annule tout, rien n'est changé.
  for f in 1..cardinality(v_fonctions) loop
    -- Une fonction absente (retirée par une migration plus récente, par exemple la qualité Q5) est sautée sans erreur.
    v_oid := to_regprocedure(v_fonctions[f]);
    if v_oid is null then
      raise notice 'titres_2_gestes_retour : % n''existe pas, sautée', v_fonctions[f];
      continue;
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
        raise exception 'titres_2_gestes_retour : le fragment % attendu dans % est présent % fois (une seule attendue) ; rien n''est changé', i, v_fonctions[f], n;
      end if;
      v_def := replace(v_def, v_ancien, v_nouveau);
    end loop;
    execute v_def;
  end loop;
end
$migration$;

-- Partie A.

drop function if exists public.geste_reseau(text);
drop function if exists public.geste_centre(integer, text);
drop function if exists public.geste_promo(integer, text);
drop function if exists public.membre_stagiaire(integer);
drop function if exists public.siege_fixe();
drop function if exists public.direction_fixe(integer);
drop function if exists public.formateur_fixe(integer);
drop function if exists public.case_reseau(text);
drop function if exists public.case_centre(integer, text);
drop function if exists public.case_promo(integer, text);
