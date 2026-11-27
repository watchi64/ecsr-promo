-- Retour de 20261128_cloisonnement_2c_donnees : remet le corps d'avant (état de la production du 27/11 avec les étapes 1, 2a et 2b)
-- de chaque fonction que l'étape 2c a remplacée et le texte d'avant des seize règles qu'elle a réécrites ; retire les fonctions
-- et les déclencheurs qu'elle a posés, les colonnes registre_qualite.organisme_id et effacements_journal.organisme_id et l'index
-- profs_organisme_nom ; remet l'unicité globale de profs.nom (profs_nom_key) et le déclencheur organisme_par_defaut des ressources à
-- l'insertion et à la modification. Mêmes signatures, mêmes droits (create or replace). Rend exactement l'empreinte d'avant l'étape
-- 2c (tests/sql/roles-empreinte.sql : règles, fonctions, droits).
-- Garde : chaque corps et chaque règle sont ceux que l'étape 2c a posés (md5, retours chariot retirés) ; aucune étape plus tardive
-- n'est en place (aucune autre fonction ni règle ne cite le vocabulaire du cloisonnement) ; aucun nom de fiche profs en double dans
-- la base (l'unicité globale revient) ; sinon rien n'est changé.
-- Ordre : le premier des retours du cloisonnement, avant celui de l'étape 2b.
-- Preuve : tests/sql/cloisonnement-preuve.sql, groupe retour.
-- À appliquer en une seule transaction :
--   psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261128_cloisonnement_2c_donnees_retour.sql

set local lock_timeout = '3s';

do $garde$
declare
  v_liste text;
begin
  select string_agg(x.f || ' (md5 ' || coalesce(md5(replace(p.prosrc, chr(13), '')), 'absente') || ')', ', ') into v_liste
    from (values
      ('public.organisme_courant()', '80557e860ea35db33b09a78fa7163dd8'),
      ('public.promo_par_defaut()', '04cd24b01e27447ac90344c5855686ba'),
      ('public.geste_promo(integer, text)', 'b47758268bfe5246de8355a67999695a'),
      ('public.case_reseau(text)', '528823b88ef868a1171da6e711fe18b7'),
      ('public.inviter_compte(text, text, integer, integer, integer)', '579abafb8ea58fa58f7b06b7b5c7cfa3'),
      ('public.donner_titre(text, bigint, integer, integer[], integer)', '615f7ad5057aa5d30d18540d148a9ae5'),
      ('public._orphelin_en_personnel(text, boolean, integer, text)', '049e1495816c8a08657622197d755352'),
      ('public._profil_formateur(text, integer, text)', '5a3f451334df2e6c4cb971eb25a66312'),
      ('public._affectations_titre()', 'bb1ce6be6fe8bc59d71804293fe9ef35'),
      ('public._contact_avant_ecriture()', '21a6c030e920c10e78365fd769b49003'),
      ('public._contact_fiche_dans(contacts, integer)', 'bc5ff169832449db51d58920e1461628'),
      ('public._contact_relais_possibles(text)', 'ba162e23b31418c01c4cd90043bff4d7'),
      ('public.ma_fiche_contact()', '170092ab99e924e628f5d2d8f3017856'),
      ('public.etat_conservation()', '0f21ca4e6654286e53478610e92a2c33'),
      ('public.etat_conservation_centre(integer)', '921da66551d68d4bed4a12ac8d211941'),
      ('public.effacer_registre_qualite()', '26223d3fe517ae03f351f66765a4992c'),
      ('public.ouvrir_questionnaire(text, jsonb, boolean)', '162966cf904838cd68ece527522f95a8'),
      ('public.resultats_questionnaire(text, jsonb)', 'd02a5fe421855eaef274cc5c52ed3ae3'),
      ('public.commentaires_questionnaire(text, jsonb)', '008bbca30e7af212132fd9bc3826c982'),
      ('public.fiches_effacees_sur_demande(integer[])', '58739512ca81321b8dabb4d2e04e6177'),
      ('public.autonomie_opposer(integer)', '8ddb2bc0ab32f7af7fd402daaf646a50'),
      ('public._organisme_unique()', 'f0ccdff439622cfcebf8c00eaa6b2a88'),
      ('public._organisme_ecriture()', 'f6e0b6da57e43e39ba3c46025eb49af6'),
      ('public._organisme_du_personnel(text)', 'ad5c76098ab1766ec8f40d132144295e'),
      ('public.organisme_de_compte(text)', '4a9a891d89f55c423ba13894dd6deb2a'),
      ('public._personnel_ailleurs(text, integer)', '5a3cd6cfe8bc10f539988d047e135359'),
      ('public._organisme_redacteur(integer)', '0e35ca8b6aeed2aa468a41f0ea29beea'),
      ('public._organisme_de_cible(text)', 'f7dd1eef935e0d062a443a1f166f9b09'),
      ('public.compte_dans_mon_organisme(text)', '04c55328507fa26e42778974e7aeb714'),
      ('public.organisme_lisible(integer)', '770cfff31c9a97bf86b7740932bd6620'),
      ('public.ressource_ecrivable(integer)', '0aeae4a4c4554abcf8d4f0d8ea1a8238'),
      ('public.qcm_signalement_traitable(integer, bigint)', 'c70b5dba7cdd891e0e46813e7aa48311'),
      ('public._personnel_un_organisme()', '13d0eb02a5f04edb8d2351120811f920'),
      ('public._effacements_journal_organisme()', '14e2ba3058de75eae8ced6f6d48cad50'),
      ('public._organisme_ligne(integer, integer, integer)', '4cc098124e402a04edbbf083c66363c6'),
      ('public.ligne_lisible(integer, integer, integer)', '0404c05f4d53f019e0af602b549c7fa5'),
      ('public.effacement_lisible(integer, text)', '916210328d8a953c758d73ca555fa83d'),
      ('public._registre_qualite_avant()', '16a69a577724ba70edf4feda7d6d426c')) x(f, attendu)
    left join pg_proc p on p.oid = to_regprocedure(x.f)
   where md5(replace(p.prosrc, chr(13), '')) is distinct from x.attendu;
  if v_liste is not null then
    raise exception 'cloisonnement_2c_retour : corps inattendu(s) : % ; rien n''est changé', v_liste;
  end if;
  select string_agg(x.r, ', ') into v_liste
    from (values
      ('conditions_acceptations_lecture', 'a9f6323856b86b60283fa6254f2df07d/d41d8cd98f00b204e9800998ecf8427e'),
      ('effacements_journal_lecture', '525ce6bdb908656942a7e7b2abb71f77/d41d8cd98f00b204e9800998ecf8427e'),
      ('profs_ecriture', '44bb18d6e14f9a33c2dbcf6278eb445c/44bb18d6e14f9a33c2dbcf6278eb445c'),
      ('profs_select_all', '8840e32e3ebfdf57a658e10574c814b5/d41d8cd98f00b204e9800998ecf8427e'),
      ('qcm_signalements_insert', 'd41d8cd98f00b204e9800998ecf8427e/0df76225ec59fffd5a6b5c705f8ef634'),
      ('qcm_signalements_lecture', 'ed4a27464158f933f8d049ceff34e3c9/d41d8cd98f00b204e9800998ecf8427e'),
      ('qcm_signalements_modification', '92d12b17c14129b652e9e0633ae5c21e/92d12b17c14129b652e9e0633ae5c21e'),
      ('qcm_signalements_suppression', '92d12b17c14129b652e9e0633ae5c21e/d41d8cd98f00b204e9800998ecf8427e'),
      ('questionnaire_ouvertures_select', '4d860909bbeed5112ee60c64350c07bb/d41d8cd98f00b204e9800998ecf8427e'),
      ('registre_qualite_ajout', 'd41d8cd98f00b204e9800998ecf8427e/a3336c0d7d0a6f4f6f90e3fc13f32738'),
      ('registre_qualite_lecture', 'a3336c0d7d0a6f4f6f90e3fc13f32738/d41d8cd98f00b204e9800998ecf8427e'),
      ('registre_qualite_modification', 'a3336c0d7d0a6f4f6f90e3fc13f32738/a3336c0d7d0a6f4f6f90e3fc13f32738'),
      ('ressources_ecriture', '4f9c93403ac2d87c5b8a2960aa694ce2/4f9c93403ac2d87c5b8a2960aa694ce2'),
      ('ressources_select_all', 'c7efbd7fecb807c9f3fb1b9bec6df426/d41d8cd98f00b204e9800998ecf8427e'),
      ('user_profiles_lecture', '48a4d71b7b8dc73b3c691f8b742b8b99/d41d8cd98f00b204e9800998ecf8427e'),
      ('user_profiles_suppression', 'd8af1df2dc8ed923396f40761045dd7e/d41d8cd98f00b204e9800998ecf8427e')) x(r, attendu)
   where (select md5(coalesce(p.qual, '')) || '/' || md5(coalesce(p.with_check, '')) from pg_policies p
           where p.schemaname = 'public' and p.policyname = x.r) is distinct from x.attendu;
  if v_liste is not null then
    raise exception 'cloisonnement_2c_retour : règle(s) inattendue(s) : % ; rien n''est changé', v_liste;
  end if;
  -- Une étape plus tardive en place : une fonction ou une règle hors des étapes 1 à 2c cite le vocabulaire du cloisonnement.
  select string_agg(x.objet, ', ' order by x.objet) into v_liste
    from (select 'fonction ' || p.proname as objet
            from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.prosrc ~ '\m(organisme_de_lieu|organisme_de_promo|organisme_actif_fondateur|fondateur_sur|organisme_courant|est_siege_de|organisme_redacteur_courant|mon_organisme|dans_mon_organisme|organismes|organisme_id|acces_fondateur|organisme_de_compte|compte_dans_mon_organisme|organisme_lisible|ressource_ecrivable|qcm_signalement_traitable|_organisme_ecriture|_organisme_du_personnel|_personnel_ailleurs|_organisme_redacteur|_organisme_ligne|ligne_lisible|effacement_lisible)\M'
             and p.proname <> all (array[
               -- étape 1
               'organisme_de_lieu', 'organisme_de_promo', 'organisme_actif_fondateur', 'fondateur_sur', 'organisme_courant', 'est_siege_de',
               'organisme_redacteur_courant', 'mon_organisme', 'organismes_pour_support', 'ouvrir_acces_support', 'fermer_acces_support',
               '_organisme_par_defaut', '_journal_droits_organisme', '_acces_fondateur_journal', '_rattachement_fondateur',
               -- étape 2a
               'est_formateur', 'est_direction', 'est_siege', 'peut_acceder_promo', 'promo_par_defaut', 'promo_courante', 'case_promo',
               'case_centre', 'case_reseau', 'siege_fixe', 'formateur_fixe', 'direction_fixe', 'membre_stagiaire',
               -- étape 2b
               'comptes_reseau', 'creer_centre', 'regler_habillage_reseau', 'habillage_par_defaut', 'inviter_compte', 'roles_du_personnel',
               '_cases_appelant', '_refus_gestion', '_refus_titre', 'donner_titre', 'retirer_titre', 'creer_titre', 'ajuster_titre',
               'supprimer_titre', 'titres_visibles', 'titres_ajustables', 'personnes_et_titres', 'journal_des_droits', 'apercu_titre',
               'dans_mon_organisme', '_habillage_reseau_miroir',
               -- étape 2c
               'geste_promo', '_orphelin_en_personnel', '_profil_formateur', '_affectations_titre', '_contact_avant_ecriture',
               '_contact_fiche_dans', '_contact_relais_possibles', 'ma_fiche_contact', 'etat_conservation', 'etat_conservation_centre',
               'effacer_registre_qualite', 'ouvrir_questionnaire', 'resultats_questionnaire', 'commentaires_questionnaire',
               'fiches_effacees_sur_demande', 'autonomie_opposer', '_organisme_unique', '_organisme_ecriture', '_organisme_du_personnel',
               'organisme_de_compte', '_personnel_ailleurs', '_organisme_redacteur', '_organisme_de_cible', 'compte_dans_mon_organisme',
               'organisme_lisible', 'ressource_ecrivable', 'qcm_signalement_traitable', '_personnel_un_organisme',
               '_effacements_journal_organisme', '_organisme_ligne', 'ligne_lisible', 'effacement_lisible', '_registre_qualite_avant'])
          union all
          select 'règle ' || r.tablename || '.' || r.policyname
            from pg_policies r
           where r.schemaname in ('public', 'storage')
             and coalesce(r.qual, '') || ' ' || coalesce(r.with_check, '') ~ '\m(organisme_de_lieu|organisme_de_promo|organisme_actif_fondateur|fondateur_sur|organisme_courant|est_siege_de|organisme_redacteur_courant|mon_organisme|dans_mon_organisme|organismes|organisme_id|acces_fondateur|organisme_de_compte|compte_dans_mon_organisme|organisme_lisible|ressource_ecrivable|qcm_signalement_traitable|_organisme_ecriture|_organisme_du_personnel|_personnel_ailleurs|_organisme_redacteur|_organisme_ligne|ligne_lisible|effacement_lisible)\M'
             and r.policyname <> all (array['acces_fondateur_lecture', 'lieux_lecture', 'affectations_lecture', 'user_profiles_lecture',
               'user_profiles_suppression', 'conditions_acceptations_lecture', 'effacements_journal_lecture', 'registre_qualite_lecture',
               'registre_qualite_ajout', 'registre_qualite_modification', 'questionnaire_ouvertures_select', 'profs_select_all',
               'profs_ecriture', 'ressources_select_all', 'ressources_ecriture', 'qcm_signalements_insert', 'qcm_signalements_lecture',
               'qcm_signalements_modification', 'qcm_signalements_suppression'])) x;
  if v_liste is not null then
    raise exception 'cloisonnement_2c_retour : une étape plus tardive est en place (%) : jouer d''abord son retour ; rien n''est changé', v_liste;
  end if;
  if exists (select 1 from public.profs p group by p.nom having count(*) > 1) then
    raise exception 'cloisonnement_2c_retour : deux fiches profs portent le même nom (dans deux organismes) : profs_nom_key ne peut pas revenir ; rien n''est changé';
  end if;
end $garde$;

-- 1. Les règles d'avant (elles ne citent plus les fonctions de l'étape 2c).
alter policy conditions_acceptations_lecture on public.conditions_acceptations using (((lower(email) = lower(( SELECT (auth.jwt() ->> 'email'::text)))) OR ( SELECT est_fondateur() AS est_fondateur) OR (( SELECT geste_promo(( SELECT promo_courante() AS promo_courante), 'stagiaires.lire'::text) AS geste_promo) AND (lower(email) IN ( SELECT lower(u.email) AS lower
   FROM user_profiles u
  WHERE (u.stagiaire_id IN ( SELECT s.id
           FROM stagiaires s
          WHERE (s.promo_id = ( SELECT promo_courante() AS promo_courante)))))))));
alter policy effacements_journal_lecture on public.effacements_journal using ((( SELECT est_fondateur() AS est_fondateur) OR (( SELECT geste_promo(( SELECT promo_courante() AS promo_courante), 'stagiaires.lire'::text) AS geste_promo) AND ((cible = ('promo '::text || ( SELECT promo_courante() AS promo_courante))) OR (cible = ('lieu '::text || ( SELECT lieu_courant() AS lieu_courant))) OR (cible IN ( SELECT ('stagiaire '::text || s.id)
   FROM stagiaires s
  WHERE (s.promo_id = ( SELECT promo_courante() AS promo_courante))))))));
alter policy profs_ecriture on public.profs using (( SELECT geste_promo(( SELECT promo_courante() AS promo_courante), 'fiches_internes.ecrire'::text) AS geste_promo)) with check (( SELECT geste_promo(( SELECT promo_courante() AS promo_courante), 'fiches_internes.ecrire'::text) AS geste_promo));
alter policy profs_select_all on public.profs using (true);
alter policy qcm_signalements_insert on public.qcm_signalements with check ((lower(email) = lower(auth.email())));
alter policy qcm_signalements_lecture on public.qcm_signalements using (((lower(email) = lower(( SELECT (auth.jwt() ->> 'email'::text)))) OR ( SELECT est_fondateur() AS est_fondateur) OR (( SELECT geste_promo(( SELECT promo_courante() AS promo_courante), 'contenus.traiter'::text) AS geste_promo) AND ((stagiaire_id IS NULL) OR (stagiaire_id IN ( SELECT s.id
   FROM stagiaires s
  WHERE (s.promo_id = ( SELECT promo_courante() AS promo_courante))))))));
alter policy qcm_signalements_modification on public.qcm_signalements using ((( SELECT est_fondateur() AS est_fondateur) OR (( SELECT geste_promo(( SELECT promo_courante() AS promo_courante), 'contenus.traiter'::text) AS geste_promo) AND ((stagiaire_id IS NULL) OR (stagiaire_id IN ( SELECT s.id
   FROM stagiaires s
  WHERE (s.promo_id = ( SELECT promo_courante() AS promo_courante)))))))) with check ((( SELECT est_fondateur() AS est_fondateur) OR (( SELECT geste_promo(( SELECT promo_courante() AS promo_courante), 'contenus.traiter'::text) AS geste_promo) AND ((stagiaire_id IS NULL) OR (stagiaire_id IN ( SELECT s.id
   FROM stagiaires s
  WHERE (s.promo_id = ( SELECT promo_courante() AS promo_courante))))))));
alter policy qcm_signalements_suppression on public.qcm_signalements using ((( SELECT est_fondateur() AS est_fondateur) OR (( SELECT geste_promo(( SELECT promo_courante() AS promo_courante), 'contenus.traiter'::text) AS geste_promo) AND ((stagiaire_id IS NULL) OR (stagiaire_id IN ( SELECT s.id
   FROM stagiaires s
  WHERE (s.promo_id = ( SELECT promo_courante() AS promo_courante))))))));
alter policy questionnaire_ouvertures_select on public.questionnaire_ouvertures using (( SELECT peut_gerer_qualite() AS peut_gerer_qualite));
alter policy registre_qualite_ajout on public.registre_qualite with check (( SELECT peut_gerer_qualite() AS peut_gerer_qualite));
alter policy registre_qualite_lecture on public.registre_qualite using (( SELECT peut_gerer_qualite() AS peut_gerer_qualite));
alter policy registre_qualite_modification on public.registre_qualite using (( SELECT peut_gerer_qualite() AS peut_gerer_qualite)) with check (( SELECT peut_gerer_qualite() AS peut_gerer_qualite));
alter policy ressources_ecriture on public.ressources using (( SELECT geste_promo(( SELECT promo_courante() AS promo_courante), 'referentiel.modifier'::text) AS geste_promo)) with check (( SELECT geste_promo(( SELECT promo_courante() AS promo_courante), 'referentiel.modifier'::text) AS geste_promo));
alter policy ressources_select_all on public.ressources using (true);
alter policy user_profiles_lecture on public.user_profiles using (((lower(email) = lower(( SELECT (auth.jwt() ->> 'email'::text)))) OR ((stagiaire_id IS NULL) AND (role <> 'stagiaire'::text) AND (( SELECT _contact_compte_equipe() AS _contact_compte_equipe) OR ( SELECT geste_reseau('directions.lire'::text) AS geste_reseau) OR ( SELECT est_fondateur() AS est_fondateur))) OR ((stagiaire_id IS NULL) AND (role = 'stagiaire'::text) AND (( SELECT est_fondateur() AS est_fondateur) OR (lower(invited_by_email) = lower(( SELECT (auth.jwt() ->> 'email'::text)))))) OR ((stagiaire_id IN ( SELECT s.id
   FROM stagiaires s
  WHERE (s.promo_id = ( SELECT promo_courante() AS promo_courante)))) AND ( SELECT geste_promo(( SELECT promo_courante() AS promo_courante), 'stagiaires.lire'::text) AS geste_promo))));
alter policy user_profiles_suppression on public.user_profiles using (((NOT is_founder) AND (NOT a_une_affectation(email)) AND (((stagiaire_id IN ( SELECT s.id
   FROM stagiaires s
  WHERE (s.promo_id = ( SELECT promo_courante() AS promo_courante)))) AND ( SELECT geste_promo(( SELECT promo_courante() AS promo_courante), 'stagiaires.gerer'::text) AS geste_promo)) OR ((stagiaire_id IS NULL) AND (role = 'stagiaire'::text) AND (( SELECT est_fondateur() AS est_fondateur) OR (( SELECT geste_promo(( SELECT promo_courante() AS promo_courante), 'stagiaires.gerer'::text) AS geste_promo) AND (lower(invited_by_email) = lower(( SELECT (auth.jwt() ->> 'email'::text))))))) OR ((stagiaire_id IS NULL) AND (role <> 'stagiaire'::text) AND ( SELECT est_fondateur() AS est_fondateur)))));

-- 2. Les corps d'avant, tels que la base les rend (pg_get_functiondef), dans l'ordre de l'étape 2c.
CREATE OR REPLACE FUNCTION public.organisme_courant()
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  v_apercu text;
  v_promo integer;
  v_o integer;
  v_n integer;
begin
  if v_moi is null then
    return null;
  end if;
  if fondateur_reel() then
    v_apercu := apercu_role();
    if v_apercu is not null and v_apercu <> 'siege' then
      v_promo := promo_courante();
      if v_promo is not null then
        return organisme_de_promo(v_promo);
      end if;
    end if;
    v_o := organisme_actif_fondateur();
    if v_o is not null then
      return v_o;
    end if;
  end if;
  v_promo := promo_courante();
  if v_promo is not null then
    return organisme_de_promo(v_promo);
  end if;
  select af.organisme_id into v_o from affectations af
   where lower(af.email) = v_moi and af.role = 'siege' and af.organisme_id is not null
   order by af.id limit 1;
  if v_o is not null then
    return v_o;
  end if;
  select min(x.o), count(distinct x.o) into v_o, v_n
    from (select case af.role when 'direction' then organisme_de_lieu(af.lieu_id) else organisme_de_promo(af.promo_id) end as o
            from affectations af
           where lower(af.email) = v_moi and af.role in ('direction', 'formateur')) x
   where x.o is not null;
  if v_n = 1 then
    return v_o;
  end if;
  select organisme_de_promo(s.promo_id) into v_o
    from user_profiles up join stagiaires s on s.id = up.stagiaire_id
   where lower(up.email) = v_moi
   order by up.email limit 1;
  return v_o;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.promo_par_defaut()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with moi as (
    select up.stagiaire_id
    from user_profiles up
    where lower(up.email) = lower((select auth.jwt() ->> 'email'))
    limit 1
  )
  select coalesce(
    (select s.promo_id from moi join stagiaires s on s.id = moi.stagiaire_id where peut_acceder_promo(s.promo_id)),
    (select pr.id from promos pr
      where peut_acceder_promo(pr.id) and (pr.date_fin is null or pr.date_fin >= current_date)
      order by pr.date_debut, pr.id limit 1),
    (select pr.id from promos pr
      where peut_acceder_promo(pr.id)
      order by pr.date_debut desc, pr.id desc limit 1)
  );
$function$
;
CREATE OR REPLACE FUNCTION public.geste_promo(p integer, p_geste text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  l integer := lieu_de_promo(p);
begin
  case p_geste
    when 'planning.lire' then
      return coalesce(case_promo(p, 'planning') >= 1 or direction_fixe(l), false);
    when 'planning.modifier' then
      return coalesce(case_promo(p, 'planning') = 2, false);
    when 'emargement.lire' then
      return coalesce(case_promo(p, 'emargement') >= 1 or case_centre(l, 'emargement') >= 1, false);
    when 'emargement.tenir' then
      return coalesce(case_promo(p, 'emargement') = 2, false);
    when 'stagiaires.lire' then
      return coalesce(case_promo(p, 'stagiaires') >= 1 or case_centre(l, 'stagiaires') >= 1, false);
    when 'stagiaires.gerer' then
      return coalesce(case_promo(p, 'stagiaires') = 2 or case_centre(l, 'stagiaires') = 2, false);
    when 'stagiaires.supprimer' then
      return coalesce(formateur_fixe(p), false);
    when 'anonymiser' then
      return coalesce(formateur_fixe(p) or direction_fixe(l), false);
    when 'benevoles.lire' then
      return coalesce(case_promo(p, 'stagiaires') >= 1 or direction_fixe(l), false);
    when 'benevoles.gerer' then
      return coalesce(case_promo(p, 'stagiaires') = 2, false);
    when 'benevoles.purger' then
      return coalesce(formateur_fixe(p), false);
    when 'notes.lire' then
      return coalesce(case_promo(p, 'notes') >= 1 or case_centre(l, 'notes') >= 1, false);
    when 'notes.saisir' then
      return coalesce(case_promo(p, 'notes') = 2, false);
    when 'contenus.lire_internes' then
      return coalesce(case_promo(p, 'cours') >= 1 or direction_fixe(l) or case_reseau('cours') >= 1, false);
    when 'contenus.rediger' then
      return coalesce(case_promo(p, 'cours') = 2 or case_reseau('cours') = 2, false);
    when 'referentiel.modifier' then
      return coalesce(case_promo(p, 'cours') = 2, false);
    when 'contenus.traiter' then
      return coalesce(case_promo(p, 'cours') = 2, false);
    when 'reglages.modifier' then
      return coalesce(case_promo(p, 'reglages') = 2, false);
    when 'modules.modifier' then
      return coalesce(case_promo(p, 'reglages') = 2 or case_centre(l, 'promos') = 2, false);
    when 'promo.renommer' then
      return coalesce(case_promo(p, 'reglages') = 2 or case_centre(l, 'promos') = 2, false);
    when 'fiches_internes.ecrire' then
      return coalesce(formateur_fixe(p) or direction_fixe(l), false);
    else
      raise exception 'titres: geste inconnu « % »', p_geste using errcode = '22023';
  end case;
end $function$
;
CREATE OR REPLACE FUNCTION public.case_reseau(p_page text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce((
    select case
             when apercu.role is not null then
               case when apercu.role = 'siege' and fondateur_sur(organisme_courant()) then _case_apercu(p_page, pg.plafond) else 0 end
             when fondateur_reel() then
               case when fondateur_sur(organisme_courant()) then pg.plafond else 0 end
             else coalesce((
               select max(case when t.fixe then pg.plafond
                               else least(pg.plafond, case t.cases ->> p_page when 'voir' then 1 when 'modifier' then 2 else 0 end)
                          end)
                 from affectations af
                 join titres t on t.id = af.titre_id
                where lower(af.email) = lower((select auth.jwt() ->> 'email'))
                  and af.role = 'siege' and af.organisme_id = organisme_courant()), 0)
           end
      from (select apercu_role() as role) apercu
     cross join (select pl.plafond from _pages_du_niveau('reseau') pl where pl.page = p_page) pg
  ), 0);
$function$
;
CREATE OR REPLACE FUNCTION public.inviter_compte(p_email text, p_role text, p_stagiaire_id integer DEFAULT NULL::integer, p_prof_id integer DEFAULT NULL::integer, p_lieu_id integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_moi text := lower(auth.jwt() ->> 'email');
  v_role text := case when p_role = 'prof' then 'formateur' else p_role end;
  v_promo integer;
  v_promo_fiche integer;
  v_anonymise timestamptz;
  v_prof integer;
  v_n bigint;
  v_aff bigint := 0;
  v_transforme boolean := false;
  v_o integer;
begin
  if v_moi is null then
    raise exception 'invitation: Connexion requise.' using errcode = '42501';
  end if;
  if v_role is null or v_role not in ('stagiaire', 'formateur', 'direction', 'siege') then
    raise exception 'invitation: Rôle inconnu.';
  end if;
  if v_email !~ '^\S+@\S+\.\S+$' then
    raise exception 'invitation: Adresse e-mail invalide.';
  end if;

  if v_role = 'stagiaire' then
    -- Formateur ou direction de la promo de la fiche.
    select s.promo_id, s.anonymise_le into v_promo_fiche, v_anonymise from stagiaires s where s.id = p_stagiaire_id;
    if v_promo_fiche is null or not geste_promo(v_promo_fiche, 'stagiaires.gerer') then
      raise exception 'invitation: Pas de droit sur la promo de ce stagiaire.' using errcode = '42501';
    end if;
    if v_anonymise is not null then
      raise exception 'invitation: Cette fiche est anonymisée.';
    end if;
    -- Une fiche n'a qu'un compte : celui qui tiendrait une seconde adresse signerait et écrirait comme le stagiaire.
    if exists (select 1 from user_profiles u where u.stagiaire_id = p_stagiaire_id and lower(u.email) <> v_email) then
      raise exception 'invitation: Cette fiche est déjà reliée à un autre compte.';
    end if;
    insert into user_profiles (email, role, is_admin, stagiaire_id, invited_by_email)
    values (v_email, 'stagiaire', false, p_stagiaire_id, v_moi)
    on conflict (email) do nothing;
    get diagnostics v_n = row_count;

  elsif v_role = 'formateur' then
    -- Direction du centre de la promo affichée, ou fondateur : l'affectation porte sur la promo affichée.
    v_promo := promo_courante();
    if v_promo is null or not geste_centre(lieu_de_promo(v_promo), 'formateurs.nommer') then
      raise exception 'invitation: Réservé à la direction du centre.' using errcode = '42501';
    end if;
    -- Un compte qui a une fiche de stagiaire n'est jamais affecté comme formateur.
    if exists (select 1 from user_profiles u where lower(u.email) = v_email and u.stagiaire_id is not null) then
      raise exception 'invitation: Cette adresse est celle d''un compte stagiaire.';
    end if;
    -- Le compte d'un ancien stagiaire (sans fiche) devient un compte du personnel, avec la fiche formateur si elle est libre.
    v_transforme := _orphelin_en_personnel(v_email, true, p_prof_id, v_moi);
    -- Le profil (et sa fiche formateur, si elle est libre) est créé par la fonction interne, commune avec
    -- regler_affectations_formateur.
    v_n := case when _profil_formateur(v_email, p_prof_id, v_moi) then 1 else 0 end;
    insert into affectations (email, role, promo_id)
    values (v_email, 'formateur', v_promo)
    on conflict do nothing;
    get diagnostics v_aff = row_count;

  elsif v_role = 'direction' then
    -- Siège ou fondateur ; le centre est donné.
    if not geste_reseau('directions.nommer') then
      raise exception 'invitation: Réservé au siège.' using errcode = '42501';
    end if;
    -- Un centre de l'organisme courant : un centre d'un autre organisme est traité comme absent.
    if p_lieu_id is null or not exists (select 1 from lieux l where l.id = p_lieu_id and l.organisme_id = organisme_courant()) then
      raise exception 'invitation: Le centre est requis.';
    end if;
    -- Personne ne se nomme soi-même à la direction (le fondateur, hors aperçu et sur l'organisme du centre, excepté).
    if v_email = v_moi and not (est_fondateur() and fondateur_sur(organisme_de_lieu(p_lieu_id))) then
      raise exception 'invitation: Vous ne pouvez pas vous nommer vous-même à la direction.' using errcode = '42501';
    end if;
    -- Un compte qui a une fiche de stagiaire n'est jamais affecté à la direction.
    if exists (select 1 from user_profiles u where lower(u.email) = v_email and u.stagiaire_id is not null) then
      raise exception 'invitation: Cette adresse est celle d''un compte stagiaire.';
    end if;
    -- Le compte d'un ancien stagiaire (sans fiche) devient un compte du personnel.
    v_transforme := _orphelin_en_personnel(v_email, false, null, v_moi);
    insert into user_profiles (email, role, is_admin, invited_by_email)
    values (v_email, 'prof', false, v_moi)
    on conflict (email) do nothing;
    get diagnostics v_n = row_count;
    insert into affectations (email, role, lieu_id)
    values (v_email, 'direction', p_lieu_id)
    on conflict do nothing;
    get diagnostics v_aff = row_count;

  else
    -- Siège : le fondateur seul, dans son organisme actif (rattachement, ou accès support ouvert) ; le siège invité est celui de
    -- cet organisme.
    v_o := organisme_actif_fondateur();
    if not (est_fondateur() and fondateur_sur(v_o)) then
      raise exception 'invitation: Réservé au fondateur.' using errcode = '42501';
    end if;
    -- Un compte qui a une fiche de stagiaire n'est jamais affecté au siège.
    if exists (select 1 from user_profiles u where lower(u.email) = v_email and u.stagiaire_id is not null) then
      raise exception 'invitation: Cette adresse est celle d''un compte stagiaire.';
    end if;
    -- Le compte d'un ancien stagiaire (sans fiche) devient un compte du personnel.
    v_transforme := _orphelin_en_personnel(v_email, false, null, v_moi);
    insert into user_profiles (email, role, is_admin, invited_by_email)
    values (v_email, 'prof', false, v_moi)
    on conflict (email) do nothing;
    get diagnostics v_n = row_count;
    insert into affectations (email, role, organisme_id)
    values (v_email, 'siege', v_o)
    on conflict do nothing;
    get diagnostics v_aff = row_count;
  end if;

  return jsonb_build_object('email', v_email, 'role', v_role, 'cree', v_n > 0, 'affecte', v_aff, 'transforme', v_transforme);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.donner_titre(p_email text, p_titre_id bigint, p_lieu_id integer, p_promo_ids integer[] DEFAULT NULL::integer[], p_prof_id integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_moi text := lower(auth.jwt() ->> 'email');
  v_titre_id bigint := p_titre_id;
  t record;
  v_lieu integer;
  v_etat text;
  v_phrase text;
  v_liste integer[] := '{}';
  v_cible text;
  v_cree boolean := false;
  v_transforme boolean := false;
  v_anciens bigint[];
  v_ancien bigint;
  v_remplace bigint;
  v_ajoutees integer[] := '{}';
  v_retirees integer[] := '{}';
  v_n bigint;
  v_o integer;
begin
  if v_moi is null then
    raise exception 'titres: Connexion requise.' using errcode = '42501';
  end if;
  if v_email !~ '^\S+@\S+\.\S+$' then
    raise exception 'titres: Adresse e-mail invalide.';
  end if;
  -- Un titre du réseau (niveau promo ou centre, sans centre) qui a une version dans ce centre se donne sous sa version.
  -- D4 : un don attend l'ajustement en cours du même titre (et inversement), puis voit sa version.
  perform 1 from titres where id = p_titre_id for share;
  select v.id into v_ancien from titres r join titres v on v.origine_id = r.id and v.lieu_id = p_lieu_id
   where r.id = p_titre_id and r.lieu_id is null and r.niveau in ('promo', 'centre') and not r.fixe;
  if v_ancien is not null then
    v_titre_id := v_ancien;
  end if;
  select r.etat, r.phrase into v_etat, v_phrase from _refus_titre(v_titre_id, p_lieu_id, v_email, 'donner') r;
  if v_etat is not null then
    raise exception '%', v_phrase using errcode = v_etat;
  end if;
  select ti.niveau, ti.fixe into t from titres ti where ti.id = v_titre_id;
  -- M4 : une fiche formateur ne se relie qu'au titre fixe Formateur.
  if p_prof_id is not null and not (t.niveau = 'promo' and t.fixe) then
    raise exception 'titres: Une fiche formateur ne se relie qu''au titre Formateur.';
  end if;
  v_lieu := case when t.niveau = 'reseau' then null else p_lieu_id end;
  -- Les promos d'un titre de promo : au moins une, toutes du centre.
  if t.niveau = 'promo' then
    select coalesce(array_agg(distinct x order by x), '{}') into v_liste from unnest(coalesce(p_promo_ids, '{}')) x where x is not null;
    if cardinality(v_liste) = 0 then
      raise exception 'titres: Choisissez au moins une promo.';
    end if;
    if exists (select 1 from unnest(v_liste) x where not exists (select 1 from promos p where p.id = x and p.lieu_id = v_lieu)) then
      raise exception 'titres: Une promo choisie n''est pas dans ce centre.';
    end if;
  end if;
  -- Le compte d'un ancien stagiaire (sans fiche) devient un compte du personnel ; un profil manquant est créé.
  -- M4, M5 : seul le titre fixe Formateur fait un compte de formateur (is_admin vrai, fiche reliée).
  v_transforme := _orphelin_en_personnel(v_email, t.niveau = 'promo' and t.fixe, case when t.niveau = 'promo' and t.fixe then p_prof_id end, v_moi);
  select u.email into v_cible from user_profiles u where lower(u.email) = v_email;
  if v_cible is null then
    if t.niveau = 'promo' and t.fixe then
      v_cree := _profil_formateur(v_email, p_prof_id, v_moi);
    else
      insert into user_profiles (email, role, is_admin, invited_by_email) values (v_email, 'prof', false, v_moi)
      on conflict (email) do nothing;
      get diagnostics v_n = row_count;
      v_cree := v_n > 0;
    end if;
    v_cible := v_email;
  end if;
  -- Un titre par niveau et par centre (ou au réseau) : l'ancien titre, s'il y en a un, est retiré, et il obéit aux règles du retrait.
  if t.niveau = 'promo' then
    select array_agg(distinct a.titre_id) into v_anciens from affectations a join promos p on p.id = a.promo_id
     where lower(a.email) = lower(v_cible) and a.role = 'formateur' and p.lieu_id = v_lieu and a.titre_id <> v_titre_id;
  elsif t.niveau = 'centre' then
    select array_agg(distinct a.titre_id) into v_anciens from affectations a
     where lower(a.email) = lower(v_cible) and a.role = 'direction' and a.lieu_id = v_lieu and a.titre_id <> v_titre_id;
  else
    -- Le siège d'un organisme : celui du titre (titre du réseau non fixe), sinon l'organisme courant (titre fixe Siège). Une
    -- affectation siège d'un autre organisme n'est ni lue ni retirée ici.
    v_o := coalesce((select ti.organisme_id from titres ti where ti.id = v_titre_id), organisme_courant());
    select array_agg(distinct a.titre_id) into v_anciens from affectations a
     where lower(a.email) = lower(v_cible) and a.role = 'siege' and a.titre_id <> v_titre_id and a.organisme_id is not distinct from v_o;
  end if;
  foreach v_ancien in array coalesce(v_anciens, '{}') loop
    select r.etat, r.phrase into v_etat, v_phrase from _refus_titre(v_ancien, v_lieu, v_cible, 'retirer') r;
    if v_etat is not null then
      raise exception '%', v_phrase using errcode = v_etat;
    end if;
    v_remplace := coalesce(v_remplace, v_ancien);
  end loop;
  -- Les lignes de l'ancien titre sont supprimées, puis les nouvelles posées (le déclencheur refuse un changement de titre en place).
  if t.niveau = 'promo' then
    delete from affectations a
     where lower(a.email) = lower(v_cible) and a.role = 'formateur' and a.titre_id = any (coalesce(v_anciens, '{}'))
       and a.promo_id in (select p.id from promos p where p.lieu_id = v_lieu);
    with retire as (
      delete from affectations a
       where lower(a.email) = lower(v_cible) and a.role = 'formateur' and a.titre_id = v_titre_id
         and a.promo_id in (select p.id from promos p where p.lieu_id = v_lieu)
         and not (a.promo_id = any (v_liste))
      returning a.promo_id)
    select coalesce(array_agg(r.promo_id order by r.promo_id), '{}') into v_retirees from retire r;
    with ajoute as (
      insert into affectations (email, role, promo_id, titre_id)
      select v_cible, 'formateur', x, v_titre_id from unnest(v_liste) x
      on conflict do nothing
      returning promo_id)
    select coalesce(array_agg(a.promo_id order by a.promo_id), '{}') into v_ajoutees from ajoute a;
  elsif t.niveau = 'centre' then
    delete from affectations a
     where lower(a.email) = lower(v_cible) and a.role = 'direction' and a.lieu_id = v_lieu and a.titre_id = any (coalesce(v_anciens, '{}'));
    insert into affectations (email, role, lieu_id, titre_id) values (v_cible, 'direction', v_lieu, v_titre_id)
    on conflict do nothing;
  else
    delete from affectations a
     where lower(a.email) = lower(v_cible) and a.role = 'siege' and a.titre_id = any (coalesce(v_anciens, '{}'))
       and a.organisme_id is not distinct from v_o;
    insert into affectations (email, role, titre_id, organisme_id) values (v_cible, 'siege', v_titre_id, v_o)
    on conflict do nothing;
  end if;
  return jsonb_build_object('email', v_cible, 'titre_id', v_titre_id, 'cree', v_cree, 'transforme', v_transforme,
                            'remplace', v_remplace, 'ajoutees', to_jsonb(v_ajoutees), 'retirees', to_jsonb(v_retirees));
end;
$function$
;
CREATE OR REPLACE FUNCTION public._orphelin_en_personnel(p_email text, p_admin boolean, p_prof_id integer, p_par text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_prof integer;
  v_n bigint;
begin
  -- Deux profils à la même adresse, à la casse près (l'ancienne clé, sensible à la casse, le permettait) : la mise en minuscules
  -- créerait un doublon. Refus clair, rien n'est changé.
  if exists (select 1 from user_profiles u where lower(u.email) = lower(p_email) and u.role = 'stagiaire' and u.stagiaire_id is null and not u.is_founder)
     and (select count(*) from user_profiles u where lower(u.email) = lower(p_email)) > 1 then
    raise exception 'invitation: Deux comptes existent pour cette adresse (écrite avec des majuscules sur l''un) : à régler par le fondateur.';
  end if;
  select pf.id into v_prof from profs pf
   where pf.id = p_prof_id and not exists (select 1 from user_profiles u where u.prof_id = pf.id);
  -- Rien n'est retiré à un compte déjà affecté : is_admin ne passe jamais de vrai à faux, invited_by_email n'est jamais réécrit
  -- (posé seulement s'il manque), la fiche formateur n'est posée que si le profil n'en a pas.
  update user_profiles u
     set role = 'prof', is_admin = u.is_admin or p_admin, prof_id = coalesce(u.prof_id, v_prof),
         invited_by_email = coalesce(u.invited_by_email, p_par),
         email = lower(u.email)   -- adresse en minuscules (les affectations suivent, FK on update cascade) : pas de doublon à l'insertion qui suit
   where lower(u.email) = lower(p_email) and u.role = 'stagiaire' and u.stagiaire_id is null and not u.is_founder;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$function$
;
CREATE OR REPLACE FUNCTION public._profil_formateur(p_email text, p_prof_id integer, p_par text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_prof integer;
  v_n bigint;
begin
  -- La fiche formateur n'est posée que si elle existe et n'est reliée à aucun compte.
  select pf.id into v_prof from profs pf
   where pf.id = p_prof_id and not exists (select 1 from user_profiles u where u.prof_id = pf.id);
  insert into user_profiles (email, role, is_admin, prof_id, invited_by_email)
  values (p_email, 'prof', true, v_prof, p_par)
  on conflict (email) do nothing;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$function$
;
CREATE OR REPLACE FUNCTION public._affectations_titre()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_niveau text := case new.role when 'formateur' then 'promo' when 'direction' then 'centre' when 'siege' then 'reseau' end;
  v_titre record;
  v_lieu integer;
begin
  if v_niveau is null then
    return new; -- un rôle inconnu est refusé par la contrainte de la table
  end if;
  if new.titre_id is null then
    new.titre_id := public.titre_fixe(v_niveau);
  end if;
  select t.niveau, t.lieu_id into v_titre from public.titres t where t.id = new.titre_id;
  if not found then
    return new; -- la clé étrangère refuse un titre qui n'existe pas
  end if;
  if v_titre.niveau <> v_niveau then
    raise exception 'titres: Ce titre ne correspond pas au niveau de cette affectation.' using errcode = '23514';
  end if;
  -- Le centre de la ligne : celui de la promo pour un formateur, le centre lui-même pour une direction.
  v_lieu := case new.role when 'formateur' then (select p.lieu_id from public.promos p where p.id = new.promo_id)
                          when 'direction' then new.lieu_id end;
  if v_titre.lieu_id is not null and v_titre.lieu_id is distinct from v_lieu then
    raise exception 'titres: Ce titre appartient à un autre centre.' using errcode = '23514';
  end if;
  -- Un titre de promo par personne et par centre (spec § 6.3).
  if new.role = 'formateur' and exists (
       select 1
         from public.affectations a
         join public.promos p on p.id = a.promo_id
        where lower(a.email) = lower(new.email) and a.role = 'formateur'
          and a.id is distinct from new.id
          and p.lieu_id is not distinct from v_lieu
          and a.titre_id <> new.titre_id) then
    raise exception 'titres: Cette personne a déjà un autre titre de promo dans ce centre.' using errcode = '23514';
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public._contact_avant_ecriture()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_avant integer[] := case when tg_op = 'UPDATE' then old.lieux_partages else '{}'::integer[] end;
  v_x integer;
begin
  new.lieux_partages := coalesce(array(select distinct x from unnest(new.lieux_partages) x
                                         where x is not null and x is distinct from new.lieu_id order by x), '{}'::integer[]);
  if exists (select 1 from unnest(new.lieux_partages) x where not exists (select 1 from lieux li where li.id = x)) then
    raise exception 'contact: Centre inconnu.';
  end if;
  if lower(auth.jwt() ->> 'email') is not null and not est_fondateur() then
    for v_x in select d.x from ((select unnest(new.lieux_partages) except select unnest(v_avant))
                                union (select unnest(v_avant) except select unnest(new.lieux_partages))) d(x) loop
      if not exists (select 1 from promos p where p.lieu_id = v_x and geste_promo(p.id, 'fiches_internes.ecrire')) then
        raise exception 'contact: Vous ne pouvez partager une fiche qu''avec un centre où vous écrivez les fiches.' using errcode = '42501';
      end if;
    end loop;
  end if;
  -- Le rattachement d'une fiche sans compte à une ligne profs (formateurs du jour, partie C) : jamais la ligne d'un compte de l'équipe
  -- (elle revient à sa fiche d'office), et une ligne qui figure au planning d'une promo d'un des centres de la fiche.
  if new.prof_id is not null and new.compte_email is null and lower(auth.jwt() ->> 'email') is not null
     and (tg_op = 'INSERT' or new.prof_id is distinct from old.prof_id) then
    if exists (select 1 from user_profiles up
                where up.prof_id = new.prof_id
                  and exists (select 1 from affectations a
                               where lower(a.email) = lower(up.email) and a.role in ('formateur', 'direction'))) then
      raise exception 'contact: Ce formateur a un compte : sa fiche est celle de son compte.' using errcode = '42501';
    end if;
    if not exists (select 1 from planning_entries pe join promos p on p.id = pe.promo_id
                    where (pe.prof_id = new.prof_id or new.prof_id = any(pe.prof_ids))
                      and (p.lieu_id = new.lieu_id or p.lieu_id = any(new.lieux_partages))) then
      raise exception 'contact: Ce formateur ne figure pas au planning de ce centre.' using errcode = '42501';
    end if;
  end if;
  if new.relais_id is not null and (tg_op = 'INSERT' or new.relais_id is distinct from old.relais_id) then
    if not exists (
      select 1 from contacts r
       where r.id = new.relais_id
         and exists (select 1
                       from (select new.lieu_id as l
                             union select unnest(new.lieux_partages)
                             union select p.lieu_id from affectations a join promos p on p.id = a.promo_id
                                    where a.role = 'formateur' and lower(a.email) = new.compte_email
                             union select a.lieu_id from affectations a
                                    where a.role = 'direction' and lower(a.email) = new.compte_email) s
                      where s.l is not null and _contact_fiche_dans(r, s.l))) then
      raise exception 'contact: Le relais doit être une personne de l''équipe de votre centre.';
    end if;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public._contact_fiche_dans(c contacts, l integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
           when l is null then false
           when c.compte_email is null then coalesce(l = c.lieu_id or l = any(c.lieux_partages), false)
           else exists (select 1 from affectations a
                         where lower(a.email) = c.compte_email
                           and ((a.role = 'formateur' and a.promo_id in (select p.id from promos p where p.lieu_id = l))
                                or (a.role = 'direction' and a.lieu_id = l)))
         end;
$function$
;
CREATE OR REPLACE FUNCTION public._contact_relais_possibles(p_email text)
 RETURNS TABLE(id bigint, nom text, centre integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with centres as (
    select p.lieu_id as l from affectations a join promos p on p.id = a.promo_id
     where a.role = 'formateur' and lower(a.email) = lower(p_email)
    union
    select a.lieu_id from affectations a where a.role = 'direction' and lower(a.email) = lower(p_email) and a.lieu_id is not null
  )
  select distinct on (c.id) c.id,
         coalesce(pf.nom, nullif(btrim(concat_ws(' ', c.prenom, c.nom)), ''), c.role,
                  (select string_agg(distinct ti.nom, ', ' order by ti.nom) from affectations a join titres ti on ti.id = a.titre_id
                    where lower(a.email) = c.compte_email
                      and ((a.role = 'formateur' and a.promo_id in (select p.id from promos p where p.lieu_id = x.l))
                           or (a.role = 'direction' and a.lieu_id = x.l)))),
         x.l
    from centres x
    join contacts c on _contact_fiche_dans(c, x.l)
    left join profs pf on pf.id = c.prof_id
   where c.compte_email is distinct from lower(p_email)
     and (c.depart_le is null or c.depart_le >= (now() at time zone 'Europe/Paris')::date)
   order by c.id, x.l;
$function$
;
CREATE OR REPLACE FUNCTION public.ma_fiche_contact()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_moi text := lower(auth.jwt() ->> 'email');
  v_fiche jsonb;
begin
  if v_moi is not null and apercu_role() is null then
    select jsonb_build_object('id', c.id, 'prenom', c.prenom, 'nom', c.nom, 'prof_id', c.prof_id, 'nom_planning', pf.nom,
                              'email', c.email, 'telephone', c.phone, 'pour_quoi', c.pour_quoi, 'quand', c.quand,
                              'relais_id', c.relais_id, 'conge_du', c.conge_du, 'conge_au', c.conge_au,
                              'verifiee', c.verifiee_le is not null, 'verifiee_le', c.verifiee_le)
      into v_fiche
      from contacts c left join profs pf on pf.id = c.prof_id
     where c.compte_email = v_moi;
  end if;
  return jsonb_build_object(
    'fiche', v_fiche,
    'email_compte', v_moi,
    'peut_ecrire', coalesce(geste_promo(promo_courante(), 'fiches_internes.ecrire'), false),
    'centres', case when v_fiche is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', li.id, 'nom', li.nom) order by li.nom collate "C", li.id)
        from lieux li
       where li.id in (select p.lieu_id from affectations a join promos p on p.id = a.promo_id
                        where a.role = 'formateur' and lower(a.email) = v_moi
                       union
                       select a.lieu_id from affectations a where a.role = 'direction' and lower(a.email) = v_moi)), '[]'::jsonb) end,
    'relais_possibles', case when v_fiche is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'nom', r.nom, 'centre', r.centre) order by r.nom collate "C", r.id)
        from _contact_relais_possibles(v_moi) r), '[]'::jsonb) end);
end $function$
;
CREATE OR REPLACE FUNCTION public.etat_conservation()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_jour date := _questionnaire_jour();
begin
  if not peut_gerer_qualite() then
    raise exception 'conservation: Réservé à la gestion de la qualité.';
  end if;
  return jsonb_build_object(
    'jour', v_jour,
    'promos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', pr.id,
               'nom', pr.nom,
               'lieu_nom', l.nom,
               'date_fin', pr.date_fin,
               'etape1_du', (pr.date_fin + interval '12 months')::date,
               'etape2_du', make_date(extract(year from pr.date_fin)::integer + 4, 1, 1),
               'a_effacer_etape1', c.etape1,
               'a_effacer_etape2', c.etape2,
               'comptes_equipe', c.equipe,
               'emargement_etape2', c.emargement) order by pr.id)
        from promos pr
        join lieux l on l.id = pr.lieu_id
        cross join lateral (
          select count(*) filter (where s.efface_le is null and not e.equipe) as etape1,
                 count(*) filter (where s.anonymise_le is null and not e.equipe) as etape2,
                 count(*) filter (where s.anonymise_le is null and e.equipe) as equipe,
                 (select count(*) from emargement_formateurs f
                   where f.promo_id = pr.id and f.signature_effacee_le is null)
                 + (select count(*) from emargement_lignes el join stagiaires sa on sa.id = el.stagiaire_id
                     where el.promo_id = pr.id and el.trace is not null and sa.anonymise_le is not null) as emargement
            from stagiaires s
            cross join lateral (
              select exists (select 1 from user_profiles u where u.stagiaire_id = s.id
                               and (u.is_admin or u.is_founder
                                    or exists (select 1 from affectations a where lower(a.email) = lower(u.email))))
                     as equipe) e
           where s.promo_id = pr.id) c
       where peut_acceder_promo(pr.id)), '[]'::jsonb),
    'portees_formateurs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'lieu_id', x.lieu_id,
               'lieu_nom', l.nom,
               'annee', x.annee,
               'a_participations', c.np > 0,
               'participations', case when c.visible then c.np end,
               'cloture_du', make_date(x.annee + 1, 1, 1),
               'close', exists (select 1 from questionnaire_clotures qc where qc.lieu_id = x.lieu_id and qc.annee = x.annee),
               'a_commentaires', c.nc > 0,
               'commentaires', case when c.visible then c.nc end,
               'commentaires_du', make_date(x.annee + 1, 12, 31),
               'a_reponses', c.nr > 0,
               'reponses', case when c.visible then c.nr end,
               'sous_seuil', greatest(c.np, c.nr) > 0 and not c.visible,
               'fige', exists (select 1 from questionnaire_resultats_figes qf
                                where qf.cle = 'fin_formateur' and qf.lieu_id = x.lieu_id and qf.annee = x.annee),
               'figeage_du', make_date(x.annee + 4, 1, 1)) order by l.nom, x.lieu_id, x.annee)
        from (select lieu_id, annee from questionnaire_reponses where cle = 'fin_formateur'
              union select lieu_id, annee from questionnaire_participations where cle = 'fin_formateur'
              union select lieu_id, annee from questionnaire_resultats_figes where cle = 'fin_formateur') x
        join lieux l on l.id = x.lieu_id
        cross join lateral (
          select k.np, k.nc, k.nr, greatest(k.np, k.nr) >= _questionnaire_seuil('fin_formateur') as visible
            from (select (select count(*) from questionnaire_participations qp
                           where qp.cle = 'fin_formateur' and qp.lieu_id = x.lieu_id and qp.annee = x.annee) as np,
                         (select count(qr.commentaire) from questionnaire_reponses qr
                           where qr.cle = 'fin_formateur' and qr.lieu_id = x.lieu_id and qr.annee = x.annee) as nc,
                         (select count(*) from questionnaire_reponses qr
                           where qr.cle = 'fin_formateur' and qr.lieu_id = x.lieu_id and qr.annee = x.annee) as nr) k) c
       where exists (select 1 from promos pr where pr.lieu_id = x.lieu_id and peut_acceder_promo(pr.id))), '[]'::jsonb),
    'registre', (select jsonb_build_object(
                   -- Même échéance que effacer_registre_qualite() et le déclencheur du lot Q4.
                   'a_effacer', count(*) filter (where r.etat = 'clos' and r.efface_le is null and r.clos_le + interval '3 years' < now()),
                   'a_clore', count(*) filter (where r.etat <> 'clos'),
                   'efface', count(*) filter (where r.efface_le is not null),
                   'prochaine_echeance', ((min(r.clos_le + interval '3 years') filter (
                      where r.etat = 'clos' and r.efface_le is null and r.clos_le + interval '3 years' >= now()))
                      at time zone 'Europe/Paris')::date)
                   from registre_qualite r));
end;
$function$
;
CREATE OR REPLACE FUNCTION public.etat_conservation_centre(p_lieu integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_jour date := _questionnaire_jour();
begin
  if p_lieu is null or not (peut_gerer_qualite() or _peut_conserver_centre(p_lieu)) then
    raise exception 'conservation: Réservé à la direction du centre.';
  end if;
  return jsonb_build_object(
    'jour', v_jour,
    'promos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', pr.id,
               'nom', pr.nom,
               'lieu_nom', l.nom,
               'date_fin', pr.date_fin,
               'etape1_du', (pr.date_fin + interval '12 months')::date,
               'etape2_du', make_date(extract(year from pr.date_fin)::integer + 4, 1, 1),
               'a_effacer_etape1', c.etape1,
               'a_effacer_etape2', c.etape2,
               'comptes_equipe', c.equipe,
               'emargement_etape2', c.emargement,
               'fin_contredite_le', case when not (peut_gerer_qualite() and peut_acceder_promo(pr.id))
                                         then _activite_apres_fin(pr.id) end) order by pr.id)
        from promos pr
        join lieux l on l.id = pr.lieu_id
        cross join lateral (
          select count(*) filter (where s.efface_le is null and not e.equipe) as etape1,
                 count(*) filter (where s.anonymise_le is null and not e.equipe) as etape2,
                 count(*) filter (where s.anonymise_le is null and e.equipe) as equipe,
                 (select count(*) from emargement_formateurs f
                   where f.promo_id = pr.id and f.signature_effacee_le is null)
                 + (select count(*) from emargement_lignes el join stagiaires sa on sa.id = el.stagiaire_id
                     where el.promo_id = pr.id and el.trace is not null and sa.anonymise_le is not null) as emargement
            from stagiaires s
            cross join lateral (
              select exists (select 1 from user_profiles u where u.stagiaire_id = s.id
                               and (u.is_admin or u.is_founder
                                    or exists (select 1 from affectations a where lower(a.email) = lower(u.email))))
                     as equipe) e
           where s.promo_id = pr.id) c
       where pr.lieu_id = p_lieu and _peut_conserver_promo(pr.id)), '[]'::jsonb),
    'portees_formateurs', '[]'::jsonb,
    'registre', null);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.effacer_registre_qualite()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  n integer;
begin
  if not peut_gerer_qualite() then
    raise exception 'registre: Tu n''as pas accès au registre qualité.';
  end if;
  update registre_qualite
     set description = null, reponse = null, action_decidee = null, mesure_prevention = null, efface_le = now()
   where etat = 'clos' and efface_le is null and clos_le + interval '3 years' < now();
  get diagnostics n = row_count;
  if n > 0 then
    insert into effacements_journal (type, cible, fait_par_email, details)
    values ('registre', 'registre', lower(auth.jwt() ->> 'email'), jsonb_build_object('entrees', n));
  end if;
  return n;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.ouvrir_questionnaire(p_cle text, p_portee jsonb, p_ouvert boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_portee record;
begin
  if not peut_gerer_qualite() then
    raise exception 'questionnaire: Réservé à la gestion de la qualité.';
  end if;
  if _questionnaire_version(p_cle) is null then
    raise exception 'questionnaire: Questionnaire inconnu.';
  end if;
  select * into v_portee from _questionnaire_portee(p_cle, p_portee);
  if v_portee.promo_id is not null and not exists (select 1 from promos where id = v_portee.promo_id) then
    raise exception 'questionnaire: Promo introuvable.';
  end if;
  if v_portee.lieu_id is not null and not exists (select 1 from lieux where id = v_portee.lieu_id) then
    raise exception 'questionnaire: Lieu introuvable.';
  end if;
  if p_ouvert and _questionnaire_clos(p_cle, v_portee.promo_id, v_portee.lieu_id, v_portee.annee) then
    raise exception 'questionnaire: Ce questionnaire est clos pour de bon (conservation des données) : il ne se rouvre plus.';
  end if;
  delete from questionnaire_ouvertures o
   where o.cle = p_cle and o.promo_id is not distinct from v_portee.promo_id
     and o.lieu_id is not distinct from v_portee.lieu_id and o.annee is not distinct from v_portee.annee;
  if p_ouvert is not null then
    insert into questionnaire_ouvertures (cle, promo_id, lieu_id, annee, ouvert, par_email)
    values (p_cle, v_portee.promo_id, v_portee.lieu_id, v_portee.annee, p_ouvert, lower(auth.jwt() ->> 'email'));
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.resultats_questionnaire(p_cle text, p_portee jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_portee record;
  f questionnaire_resultats_figes%rowtype;
  c jsonb;
begin
  if not peut_gerer_qualite() then
    raise exception 'questionnaire: Réservé à la gestion de la qualité.';
  end if;
  if _questionnaire_version(p_cle) is null then
    raise exception 'questionnaire: Questionnaire inconnu.';
  end if;
  select * into v_portee from _questionnaire_portee(p_cle, p_portee);

  select * into f from questionnaire_resultats_figes r
   where r.cle = p_cle and r.promo_id is not distinct from v_portee.promo_id
     and r.lieu_id is not distinct from v_portee.lieu_id and r.annee is not distinct from v_portee.annee;
  if found then
    return jsonb_build_object(
      'cle', p_cle,
      'public', _questionnaire_public(p_cle),
      'seuil', f.seuil,
      'reponses', f.reponses,
      'questions', f.questions,
      'fige', true,
      'fige_le', f.fige_le);
  end if;

  c := _questionnaire_comptes(p_cle, v_portee.promo_id, v_portee.lieu_id, v_portee.annee);
  return jsonb_build_object(
    'cle', p_cle,
    'public', _questionnaire_public(p_cle),
    'seuil', _questionnaire_seuil(p_cle),
    'reponses', c -> 'reponses',
    'questions', c -> 'questions');
end;
$function$
;
CREATE OR REPLACE FUNCTION public.commentaires_questionnaire(p_cle text, p_portee jsonb)
 RETURNS SETOF text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_portee record;
  n integer;
begin
  if not est_fondateur() then
    raise exception 'questionnaire: Réservé à l''éditeur.';
  end if;
  if _questionnaire_version(p_cle) is null then
    raise exception 'questionnaire: Questionnaire inconnu.';
  end if;
  select * into v_portee from _questionnaire_portee(p_cle, p_portee);
  select count(*) into n from questionnaire_reponses r
   where r.cle = p_cle and r.promo_id is not distinct from v_portee.promo_id
     and r.lieu_id is not distinct from v_portee.lieu_id and r.annee is not distinct from v_portee.annee;
  if n < _questionnaire_seuil(p_cle) then
    return;
  end if;
  return query
    select r.commentaire from questionnaire_reponses r
     where r.cle = p_cle and r.promo_id is not distinct from v_portee.promo_id
       and r.lieu_id is not distinct from v_portee.lieu_id and r.annee is not distinct from v_portee.annee
       and r.commentaire is not null
     order by random();
end;
$function$
;
CREATE OR REPLACE FUNCTION public.fiches_effacees_sur_demande(p_promo_ids integer[])
 RETURNS SETOF integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select s.id
    from stagiaires s
   where s.promo_id = any (coalesce(p_promo_ids, '{}'::integer[]))
     and (est_fondateur() or geste_promo(s.promo_id, 'stagiaires.lire'))
     and exists (select 1 from effacements_journal j where j.type = 'demande' and j.cible = 'stagiaire ' || s.id)
   order by s.id;
$function$
;
CREATE OR REPLACE FUNCTION public.autonomie_opposer(p_stagiaire integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not est_fondateur() then
    raise exception 'autonomie: Réservé au fondateur.';
  end if;
  perform _autonomie_opposer(p_stagiaire);
end $function$
;
CREATE OR REPLACE FUNCTION public._registre_qualite_avant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_lieu integer;
  v_textes constant text[] := array['description', 'reponse', 'action_decidee', 'mesure_prevention'];
begin
  if tg_op = 'UPDATE' then
    -- Mise à nul seule du lien (purge à 12 mois, compte fermé, ou le gestionnaire) : passe toujours, rien d'autre ne
    -- bouge.
    if old.signalement_id is not null and new.signalement_id is null
       and (to_jsonb(new) - 'signalement_id') = (to_jsonb(old) - 'signalement_id') then
      return new;
    end if;
    if old.efface_le is not null then
      raise exception 'registre: Cette entrée est effacée : elle ne se modifie plus.';
    end if;
    if new.signalement_id is not null and new.signalement_id is distinct from old.signalement_id then
      raise exception 'registre: Le lien vers le signalement ne se change pas : tu peux seulement le retirer.';
    end if;
    new.cree_le := old.cree_le;
    new.issu_signalement := old.issu_signalement;
  else
    new.cree_le := now();
    new.issu_signalement := new.signalement_id is not null;
  end if;
  new.modifie_le := now();

  -- Clôture : posée au passage à clos, gardée tant que l'entrée reste close, remise à nul à la réouverture.
  if new.etat = 'clos' then
    new.clos_le := case when tg_op = 'UPDATE' and old.etat = 'clos' then old.clos_le else now() end;
  else
    new.clos_le := null;
  end if;

  -- Lieu : celui de la promo quand il y en a une, posé à la création, quand la promo change ou quand le lieu change. Un
  -- lieu fourni contraire est refusé ; à la modification, un lieu laissé tel quel suit la nouvelle promo. Promo et lieu
  -- inchangés : le lieu reste celui de l'entrée, même si la promo a changé de centre depuis (une promo l'a déjà fait,
  -- 20261003_multi_promo_montpellier.sql) : l'effacement et la mise à nul du lien ne s'y heurtent donc pas.
  if new.promo_id is not null
     and (tg_op = 'INSERT' or new.promo_id is distinct from old.promo_id or new.lieu_id is distinct from old.lieu_id) then
    select pr.lieu_id into v_lieu from promos pr where pr.id = new.promo_id;
    if found then
      if new.lieu_id is not null and new.lieu_id <> v_lieu
         and (tg_op = 'INSERT' or new.lieu_id is distinct from old.lieu_id) then
        raise exception 'registre: Le centre ne correspond pas à la promo choisie.';
      end if;
      new.lieu_id := v_lieu;
    end if;
  end if;

  -- Effacement : après l'échéance seulement, les quatre textes à nul, rien d'autre ne change.
  if new.efface_le is not null then
    if new.clos_le is null or not (new.clos_le + interval '3 years' < now()) then
      raise exception 'registre: Cette entrée ne peut pas encore être effacée : il faut attendre 3 ans après sa clôture.';
    end if;
    if new.description is not null or new.reponse is not null or new.action_decidee is not null
       or new.mesure_prevention is not null then
      raise exception 'registre: L''effacement vide les quatre textes (description, réponse, action décidée, mesure de prévention).';
    end if;
    if (to_jsonb(new) - v_textes - array['efface_le', 'modifie_le'])
       is distinct from (to_jsonb(old) - v_textes - array['efface_le', 'modifie_le']) then
      raise exception 'registre: L''effacement ne change que les textes.';
    end if;
    new.efface_le := now();
  end if;
  return new;
end;
$function$
;

-- 3. Les déclencheurs, les colonnes et les unicités d'avant.
drop trigger personnel_un_organisme on public.affectations;
drop trigger effacements_journal_organisme on public.effacements_journal;
alter table public.registre_qualite drop column organisme_id;
alter table public.effacements_journal drop column organisme_id;
drop index public.profs_organisme_nom;
alter table public.profs add constraint profs_nom_key unique (nom);
drop trigger organisme_par_defaut on public.ressources;
create trigger organisme_par_defaut before insert or update on public.ressources
  for each row when (new.organisme_id is null) execute function public._organisme_par_defaut();

-- 4. Les fonctions nouvelles de l'étape 2c.
drop function public._personnel_un_organisme();
drop function public._effacements_journal_organisme();
drop function public.ligne_lisible(integer, integer, integer);
drop function public.effacement_lisible(integer, text);
drop function public._organisme_ligne(integer, integer, integer);
drop function public.compte_dans_mon_organisme(text);
drop function public.organisme_lisible(integer);
drop function public.ressource_ecrivable(integer);
drop function public.qcm_signalement_traitable(integer, bigint);
drop function public._organisme_de_cible(text);
drop function public._organisme_redacteur(integer);
drop function public._personnel_ailleurs(text, integer);
drop function public.organisme_de_compte(text);
drop function public._organisme_du_personnel(text);
drop function public._organisme_ecriture();
drop function public._organisme_unique();
