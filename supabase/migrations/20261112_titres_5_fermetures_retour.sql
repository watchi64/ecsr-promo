-- Marche arrière de 20261112_titres_5_fermetures.sql : remet les textes d'origine des fonctions réécrites par fragments (le bloc vient
-- de outils/generer_fragments_titres_5.py retour : ne pas le modifier à la main) puis retire retirer_titre. Après ce retour, la base est
-- dans l'état d'avant la migration (empreinte des règles, des fonctions et des droits identique).
set local lock_timeout = '3s';

-- Garde : ce retour se joue après le retour de la migration 6. Joué seul, il laisserait donner_titre et ses voisines appeler
-- retirer_titre, qui n'existerait plus.
do $garde$
begin
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'donner_titre') then
    raise exception 'titres_5_fermetures_retour : jouer d''abord le retour de la migration 6 (20261112_titres_6_gestion_retour.sql) ; rien n''est changé' using errcode = 'P0001';
  end if;
end $garde$;

-- C. Les deux règles de lecture retrouvent leur expression d'origine : affectations_lecture celle du lot 4 (20261028_roles_1_fondations.sql),
-- user_profiles_lecture celle de 20261112_titres_3_regles.sql, relues dans les fichiers (une seule source).
alter policy affectations_lecture on public.affectations
  using (
       lower(email) = lower((select auth.jwt() ->> 'email'))
    or (select public.est_fondateur())
    or (role = 'formateur'
        and (public.est_formateur(promo_id) or public.est_direction(public.lieu_de_promo(promo_id))))
    or (role = 'direction' and public.est_direction(lieu_id))
    or (role in ('direction', 'siege') and (select public.est_siege()))
  );

alter policy user_profiles_lecture on public.user_profiles
  using (lower(email) = lower((select auth.jwt() ->> 'email')) or (stagiaire_id is null and role <> 'stagiaire' and ((select public.promo_par_defaut()) is not null or (select public.est_siege()) or (select public.est_fondateur()))) or (stagiaire_id is null and role = 'stagiaire' and ((select public.est_fondateur()) or lower(invited_by_email) = lower((select auth.jwt() ->> 'email')))) or (stagiaire_id in (select s.id from public.stagiaires s where s.promo_id = (select public.promo_courante())) and (select public.geste_promo((select public.promo_courante()), 'stagiaires.lire'))));

-- B. Les droits d'insertion et de suppression de authenticated sur affectations, et les deux expressions de la migration 3
-- (20261112_titres_3_regles.sql, relues dans le fichier : une seule source).
grant delete on public.affectations to authenticated;
grant insert (email, role, promo_id, lieu_id) on public.affectations to authenticated;

alter policy affectations_ajout on public.affectations
  with check ((role = 'formateur' and public.geste_centre(public.lieu_de_promo(promo_id), 'formateurs.nommer')) or (role = 'direction' and (select public.geste_reseau('directions.nommer'))) or (role = 'siege' and (select public.est_fondateur())));

alter policy affectations_retrait on public.affectations
  using ((role = 'formateur' and public.geste_centre(public.lieu_de_promo(promo_id), 'formateurs.nommer')) or (role = 'direction' and (select public.geste_reseau('directions.nommer'))) or (role = 'siege' and (select public.est_fondateur())));

do $migration$
declare
  v_fonctions text[] := array[
    'public.inviter_compte(text, text, integer, integer, integer)',
    'public.geste_centre(integer, text)',
    'public.notes_stagiaires_visibles()',
    'public.roles_du_personnel()'];
  -- La fonction de chaque fragment (rang dans v_fonctions).
  v_de integer[] := array[1, 2, 3, 4];
  v_anciens text[] := array[
$ancien$    -- Personne ne se nomme soi-même à la direction (le fondateur, hors aperçu, excepté).
    if v_email = v_moi and not est_fondateur() then
      raise exception 'invitation: Vous ne pouvez pas vous nommer vous-même à la direction.' using errcode = '42501';
    end if;
    -- Un compte qui a une fiche de stagiaire n'est jamais affecté à la direction.
$ancien$,
$ancien$    when 'promos.lire' then
      return coalesce(case_centre(l, 'promos') >= 1, false);
    when 'equipe.lire' then
$ancien$,
$ancien$   where s.promo_id = promo_courante()
     and (membre_stagiaire(promo_courante()) or geste_promo(promo_courante(), 'notes.lire'))
$ancien$,
$ancien$(geste_promo(promo_courante(), 'reglages.modifier') or geste_centre(lieu_de_promo(promo_courante()), 'equipe.lire') or geste_reseau('directions.lire') or est_fondateur())$ancien$];
  v_nouveaux text[] := array[
$nouveau$    -- Un compte qui a une fiche de stagiaire n'est jamais affecté à la direction.
$nouveau$,
$nouveau$    when 'equipe.lire' then
$nouveau$,
$nouveau$   where s.promo_id = promo_courante()
$nouveau$,
$nouveau$(equipe_courante() or est_siege() or est_fondateur())$nouveau$];
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
      raise exception 'titres_5_fermetures_retour : % n''existe pas ; rien n''est changé', v_fonctions[f];
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
        raise exception 'titres_5_fermetures_retour : le fragment % attendu dans % est présent % fois (une seule attendue) ; rien n''est changé', i, v_fonctions[f], n;
      end if;
      v_def := replace(v_def, v_ancien, v_nouveau);
    end loop;
    execute v_def;
  end loop;
end
$migration$;

-- A. retirer_titre
drop function if exists public.retirer_titre(text, bigint, integer);
