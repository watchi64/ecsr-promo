-- Cloisonnement par organisme, étape 2c : les données (spec docs/superpowers/specs/2026-11-27-cloisonnement-organismes-design.md,
-- § 5.2 bornage complet, § 5.3 lignes « Personnel », « Annuaire », « Planning », « Contenus communs », § 5.7 ; plan, tâche 5).
-- Mêmes signatures, mêmes droits d'exécution pour les fonctions remplacées (create or replace), security definer et chemin de
-- recherche gardés. Avec un seul organisme (ECF aujourd'hui), rien ne change pour l'app : les preuves existantes gardent leur verdict.
-- Ce qu'elle change :
--   * Personnel : un membre du personnel n'appartient qu'à un organisme. Le déclencheur personnel_un_organisme refuse une
--     affectation dans un autre organisme que celui des affectations existantes de la même adresse (« Cette adresse ne peut pas être
--     invitée ici. », 23514) ; inviter_compte (formateur, direction, siège) et donner_titre rendent le même refus avant toute
--     écriture (une adresse siège d'un autre organisme recevait un succès sans écriture). _affectations_titre refuse en défense un
--     titre du réseau d'un organisme posé sur une affectation d'un autre. _orphelin_en_personnel et _profil_formateur ne relient
--     qu'une fiche profs de l'organisme de l'appelant, et l'ancien inviteur d'un autre organisme est remplacé par le nouveau.
--     organisme_courant() : sans en-tête x-promo-id, l'affectation du personnel passe avant une ancienne fiche de stagiaire ;
--     promo_par_defaut() ne prend qu'une promo de l'organisme du personnel (fondateur excepté).
--     Lectures jugées sur l'organisme du profil lu (organisme_de_compte : ses affectations, sinon la promo de sa fiche de stagiaire la
--     plus récente, sinon l'organisme de qui l'a invité, sinon l'organisme unique) : user_profiles_lecture (personnel, invitations,
--     _contact_compte_equipe), user_profiles_suppression, conditions_acceptations_lecture ; effacements_journal_lecture jugée sur
--     l'organisme de la cible de la ligne, sinon sur effacements_journal.organisme_id (nouvelle, posée quand la cible ne le dit pas :
--     l'organisme courant de l'auteur).
--   * Annuaire : _contact_avant_ecriture traite un centre de partage d'un autre organisme comme inconnu, une fiche profs d'un autre
--     organisme comme absente du planning, et ne laisse passer le fondateur que sur l'organisme de la fiche ; _contact_fiche_dans,
--     _contact_relais_possibles et ma_fiche_contact : centres de l'organisme seulement.
--   * Planning : profs lue et écrite dans l'organisme ; profs.nom unique par organisme (profs_nom_key retirée, index
--     profs_organisme_nom) ; une ligne de planning_entries (prof_id, prof_ids), passages, emargement_formateurs ou epcf_evaluations
--     (evaluateur_prof_id) ne cite qu'une fiche profs de l'organisme de sa promo (déclencheur verif_profs_organisme, « Fiche formateur
--     introuvable. », 23514) ; _contact_annexes, _contact_nom_fiche, annuaire_centre, _contact_relais_possibles et ma_fiche_contact
--     ne lisent le nom que d'une fiche profs de l'organisme du centre.
--   * Contenus communs : geste_promo(contenus.lire_internes, contenus.rediger, contenus.traiter, referentiel.modifier) et
--     case_reseau('cours') exigent un organisme rédacteur, sauf pour le fondateur hors aperçu, qui écrit les contenus communs quel
--     que soit son organisme actif (spec § 5.2) ; la lecture des contenus publiés ne change pas. ressources : organisme_id nul
--     = carte commune (lue par tous, écrite par le rédacteur), sinon lue et écrite par l'organisme ; le déclencheur organisme_par_defaut
--     des ressources ne joue plus qu'à l'insertion (une carte peut devenir commune).
--   * Signalements de QCM : lus et traités par l'équipe de l'organisme de la ligne (et le fondateur sur son organisme actif) ;
--     qcm_signalement_instruction et qcm_ia_brouillons restent réservés au geste contenus.traiter, désormais du seul rédacteur.
--   * Qualité et conservation : registre_qualite.organisme_id (nouvelle, posée par _registre_qualite_avant pour une entrée sans promo
--     ni centre : l'organisme courant de l'auteur ; l'existant sans promo ni centre : l'organisme unique ; une entrée avec promo ou
--     centre en reste sans, celui de son centre fait foi) ; registre, ouvertures de questionnaires,
--     etat_conservation, etat_conservation_centre, effacer_registre_qualite, ouvrir_questionnaire, resultats_questionnaire,
--     commentaires_questionnaire, fiches_effacees_sur_demande, autonomie_opposer : le fondateur seulement sur l'organisme de la promo,
--     du centre ou de la ligne (fondateur_sur). Les autres effacer_* et clore_annee_formateurs l'étaient déjà par peut_acceder_promo.
--   * Restent globaux (spec § 5.2) : signalements_app, le verrou titres_ouverts, l'écriture des contenus communs par le fondateur
--     (cours, versions), effacer_adresse_journal, le journal du fondateur (acces_fondateur, lu par lui).
-- Fonctions nouvelles (security definer, chemin fixé, droits retirés) : _organisme_unique, _organisme_ecriture, _organisme_du_personnel,
-- organisme_de_compte, _personnel_ailleurs, _organisme_redacteur, _organisme_de_cible, et les déclencheurs _profs_de_l_organisme,
-- _personnel_un_organisme,
-- _effacements_journal_organisme, _organisme_ligne ; ouvertes à authenticated (les règles les appellent avec les droits de l'appelant,
-- chacune ne rend qu'un booléen) : compte_dans_mon_organisme, organisme_lisible, ressource_ecrivable, qcm_signalement_traitable,
-- ligne_lisible, effacement_lisible.
-- Garde : étapes 1, 2a et 2b en place ; le corps (md5, retours chariot retirés) de chaque fonction remplacée et de chaque fonction dont
-- le sens est repris tel quel, le texte des seize règles réécrites, la contrainte profs_nom_key et le déclencheur des ressources sont
-- ceux de l'état de la production du 27/11 avec les étapes 1, 2a et 2b ; aucun objet de l'étape 2c n'existe ; aucune adresse n'a
-- d'affectations dans deux organismes ; une ligne du registre ou du journal des effacements dont l'organisme ne se lit pas ne se
-- remplit que s'il n'y a qu'un organisme. Sinon rien n'est changé.
-- Preuve : tests/sql/cloisonnement-preuve.sql, groupes personnel, annuaire, planning, contenus, signalements, qualite, matrice
-- (node outils/assembler_repetition_roles.mjs cloisonnement --etapes 1,2a,2b,2c <sortie>) ; contre-épreuve : cloisonnement-sabotage.
-- Retour : 20261128_cloisonnement_2c_donnees_retour.sql (le premier des retours, avant celui de l'étape 2b).
-- À appliquer en une seule transaction, après les étapes 1, 2a et 2b :
--   psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261128_cloisonnement_2c_donnees.sql

set local lock_timeout = '3s';

do $garde$
declare
  v_liste text;
begin
  if to_regprocedure('public.dans_mon_organisme(integer, integer, integer)') is null or to_regclass('public.organismes') is null
     or to_regprocedure('public.fondateur_sur(integer)') is null then
    raise exception 'cloisonnement_2c : étapes 1, 2a ou 2b absentes ; rien n''est changé';
  end if;
  select string_agg(x.f || ' (md5 ' || coalesce(md5(replace(p.prosrc, chr(13), '')), 'absente') || ')', ', ') into v_liste
    from (values
      -- Remplacées.
      ('public.organisme_courant()', '2cbbdb71f71728154793265d0d3a559d'),
      ('public.promo_par_defaut()', 'ac16be27205d0a3a276a33c7a4ebb5a7'),
      ('public.geste_promo(integer, text)', '195a0bf62a5b9b73c66ac9d9ea1dcc9d'),
      ('public.case_reseau(text)', '1394175eafc6b032c74c08b34bfa723d'),
      ('public.inviter_compte(text, text, integer, integer, integer)', 'b7373acb54724d387a9fc5287de61b8c'),
      ('public.donner_titre(text, bigint, integer, integer[], integer)', 'ad2e2072cc9ee26cce3ed2ffabd692a1'),
      ('public._orphelin_en_personnel(text, boolean, integer, text)', '54f318e538b04e5895c7a369e232c2e1'),
      ('public._profil_formateur(text, integer, text)', '180172bebfe7dcf47d436dffaa7c1268'),
      ('public._affectations_titre()', '8d28bacbba0eeaf24cdc18d476a25f5f'),
      ('public._contact_avant_ecriture()', '4d3063d4385706142c250b2c667d2d77'),
      ('public._contact_fiche_dans(contacts, integer)', '2f962cb7b9080259b8bb5e7fdacc9dbd'),
      ('public._contact_relais_possibles(text)', 'a5d5935c97a7427a25bbd768fd36dbcf'),
      ('public.ma_fiche_contact()', '4e865d5f67243c0759ce6a9a307e8a1d'),
      ('public.etat_conservation()', '9afef22527ac8f7c84b5cd0c6f443ee4'),
      ('public.etat_conservation_centre(integer)', '2785426a551869f0eaefd7a02efb1b65'),
      ('public.effacer_registre_qualite()', '597b3ce90c81b7b0bbe9a1dd2bcfe404'),
      ('public.ouvrir_questionnaire(text, jsonb, boolean)', '132ef01a091fd771453fa2ae4fffa586'),
      ('public.resultats_questionnaire(text, jsonb)', 'c0fcd430eac37e441a15ae841d14017d'),
      ('public.commentaires_questionnaire(text, jsonb)', 'e1c32dda810a19c4277a6978ffc65ae2'),
      ('public.fiches_effacees_sur_demande(integer[])', '02ef19faa63152b5b265f49c45a4a5d3'),
      ('public.autonomie_opposer(integer)', 'e6f98da007ba0ff9b0246417281bb797'),
      ('public._registre_qualite_avant()', 'f712593bd6b10530b02db1c3ef02fdc5'),
      ('public._contact_annexes(integer, integer, jsonb, integer)', 'bf20f6b3086fe23ad16fd949819af1ab'),
      ('public._contact_nom_fiche(contacts, integer)', 'e212753ca5157e239699d0aa05a0edb1'),
      ('public.annuaire_centre()', '9c715c63764095643164ba01c67aff7a'),
      -- Gardées telles quelles : leur sens est celui des étapes 1, 2a et 2b.
      ('public.est_fondateur()', '87f35299949ab3db2d8c686e4665f263'),
      ('public.fondateur_reel()', 'c275a072a60fafffbab944893dd500cf'),
      ('public.fondateur_sur(integer)', 'fa4e97d9eb5de319506fbddac3a866e8'),
      ('public.organisme_actif_fondateur()', '0f7abfe5bd52d0b35883ce4a85eb2bf9'),
      ('public.organisme_de_lieu(integer)', '55169ae2b914a4237344b938ff549a28'),
      ('public.organisme_de_promo(integer)', 'd0dba3837386f9e74cf300f1480b359e'),
      ('public.dans_mon_organisme(integer, integer, integer)', 'f28c59e70b7c8334bcab21e33bf91402'),
      ('public._organisme_par_defaut()', '2ba280535309917197138efe8a6f01aa'),
      ('public.peut_gerer_qualite()', '2526be6797c37034b1956fc026e93bbe'),
      ('public.case_promo(integer, text)', 'b1f29236f7572342eb10b94444049cfb'),
      ('public.peut_acceder_promo(integer)', 'e39a7d18dbaf5f8ef650893e70c84e7e'),
      ('public._contact_compte_equipe()', 'ccc518f8ace92a25097a3474f6bbe805'),
      ('public.a_une_affectation(text)', '99b01188993c66efaa99615580acfef9'),
      ('public._peut_conserver_promo(integer)', 'f8a60593723efd16d8e8785bd3f8caa8'),
      ('public.clore_annee_formateurs(integer, integer)', '02191250df20a8063a756ac4e51ad158'),
      ('public.effacer_commentaires_formateurs(integer, integer)', 'e8f5ef16dfa63768a397d206b7f8104f'),
      ('public.figer_questionnaire_formateurs(integer, integer)', '8747319fa06590e1e852929b43a6da4c'),
      ('public.effacer_promo_etape1(integer)', '6e0a9f1a9aa03e2bac0d386f187cc7ef'),
      ('public.effacer_promo_etape2(integer)', 'f75ec7edf416aaa0980449b8c96f8c8e'),
      ('public.effacer_sur_demande(integer)', 'c0bf12d08a11f96cfa5f618dfdedc52e'),
      ('public.accepter_brouillon_ia(bigint, text, text, text, jsonb)', 'bf49bb638d6081bb065ef54f9d51aea4'),
      ('public.rejeter_brouillon_ia(bigint)', '6b67dcca3bc845bcacf9d3b030766fc8'),
      ('public.is_admin()', '2714cd66c76a003b4862c15dc9e0b6d6'),
      ('public.is_prof()', '2714cd66c76a003b4862c15dc9e0b6d6'),
      ('public.regler_affectations_formateur(text, integer, integer[], integer)', 'c6faf6c061eb63dbbd184a0c83ec7741'),
      ('public.organisme_redacteur_courant()', 'ad883edf78b4a32691dbd154b99ee2c2'),
      ('public.apercu_role()', '20cda94e10ec18d8819e91f781a3b5b0'),
      ('public.lieu_de_promo(integer)', '631e15751a71706aa60750ac60ba4e48'),
      ('public.my_stagiaire_id()', 'e49f5c89c1c3aa094fb983a06f5c3bd5'),
      ('public.est_siege()', '03ab8d1c738827dc5ab5157b92218ce7'),
      ('public.geste_reseau(text)', 'd746b4c94ef274ea02fbf281d10e5b89')) x(f, attendu)
    left join pg_proc p on p.oid = to_regprocedure(x.f)
   where md5(replace(p.prosrc, chr(13), '')) is distinct from x.attendu;
  if v_liste is not null then
    raise exception 'cloisonnement_2c : corps inattendu(s) : % ; rien n''est changé', v_liste;
  end if;
  select string_agg(x.r, ', ') into v_liste
    from (values
      ('conditions_acceptations_lecture', '54080f1d22003158f77a783ecd27e87e/d41d8cd98f00b204e9800998ecf8427e'),
      ('effacements_journal_lecture', '4dec43ea48a962e2349bcdc2319de3ba/d41d8cd98f00b204e9800998ecf8427e'),
      ('profs_ecriture', 'fb3c55807d361ab16fa410a70805bbd2/fb3c55807d361ab16fa410a70805bbd2'),
      ('profs_select_all', 'b326b5062b2f0e69046810717534cb09/d41d8cd98f00b204e9800998ecf8427e'),
      ('qcm_signalements_insert', 'd41d8cd98f00b204e9800998ecf8427e/5daf270999ef296b18fbca96d408a46c'),
      ('qcm_signalements_lecture', '2cc7ff87a0a59335b32cbca9d548e117/d41d8cd98f00b204e9800998ecf8427e'),
      ('qcm_signalements_modification', '138038378a9dac34993dde589633be4c/138038378a9dac34993dde589633be4c'),
      ('qcm_signalements_suppression', '138038378a9dac34993dde589633be4c/d41d8cd98f00b204e9800998ecf8427e'),
      ('questionnaire_ouvertures_select', '46bc1e347edc75a856b59a7c06a07ee0/d41d8cd98f00b204e9800998ecf8427e'),
      ('registre_qualite_ajout', 'd41d8cd98f00b204e9800998ecf8427e/46bc1e347edc75a856b59a7c06a07ee0'),
      ('registre_qualite_lecture', '46bc1e347edc75a856b59a7c06a07ee0/d41d8cd98f00b204e9800998ecf8427e'),
      ('registre_qualite_modification', '46bc1e347edc75a856b59a7c06a07ee0/46bc1e347edc75a856b59a7c06a07ee0'),
      ('ressources_ecriture', '0e74b63407ca42bfa3fd61e3ae6250ec/0e74b63407ca42bfa3fd61e3ae6250ec'),
      ('ressources_select_all', 'b326b5062b2f0e69046810717534cb09/d41d8cd98f00b204e9800998ecf8427e'),
      ('user_profiles_lecture', 'e550650e61756d11d561983cbcf1438f/d41d8cd98f00b204e9800998ecf8427e'),
      ('user_profiles_suppression', 'c3d72945f45a706d18bfedcbfeea35ff/d41d8cd98f00b204e9800998ecf8427e')) x(r, attendu)
   where (select md5(coalesce(p.qual, '')) || '/' || md5(coalesce(p.with_check, '')) from pg_policies p
           where p.schemaname = 'public' and p.policyname = x.r) is distinct from x.attendu;
  if v_liste is not null then
    raise exception 'cloisonnement_2c : règle(s) inattendue(s) : % ; rien n''est changé', v_liste;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profs'::regclass and conname = 'profs_nom_key')
     or (select md5(pg_get_triggerdef(t.oid)) from pg_trigger t where t.tgrelid = 'public.ressources'::regclass and t.tgname = 'organisme_par_defaut')
        is distinct from '00d92739e5b325e03506055601ce4b1b' then
    raise exception 'cloisonnement_2c : contrainte ou déclencheur inattendu (profs_nom_key, organisme_par_defaut des ressources) ; rien n''est changé';
  end if;
  if exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
               and p.proname in ('_organisme_unique', '_organisme_ecriture', '_organisme_du_personnel', 'organisme_de_compte',
                                 '_personnel_ailleurs', '_organisme_redacteur', '_organisme_de_cible', 'compte_dans_mon_organisme',
                                 'organisme_lisible', 'ressource_ecrivable', 'qcm_signalement_traitable', '_personnel_un_organisme',
                                 '_effacements_journal_organisme', '_organisme_ligne', 'ligne_lisible', 'effacement_lisible',
                                 '_profs_de_l_organisme'))
     or exists (select 1 from pg_attribute a where a.attrelid in ('public.registre_qualite'::regclass, 'public.effacements_journal'::regclass)
                  and a.attname = 'organisme_id' and not a.attisdropped)
     or to_regclass('public.profs_organisme_nom') is not null then
    raise exception 'cloisonnement_2c : un objet de l''étape 2c existe déjà ; rien n''est changé';
  end if;
  if exists (select 1 from public.affectations a
              group by lower(a.email)
             having count(distinct coalesce(a.organisme_id, public.organisme_de_lieu(a.lieu_id), public.organisme_de_promo(a.promo_id))) > 1) then
    raise exception 'cloisonnement_2c : une adresse a des affectations dans deux organismes : à régler avant ; rien n''est changé';
  end if;
  if (select count(*) from public.organismes) <> 1
     and (exists (select 1 from public.registre_qualite r where r.promo_id is null and r.lieu_id is null)
          or exists (select 1 from public.effacements_journal j where j.cible !~ '^(promo|stagiaire|lieu) [0-9]')) then
    raise exception 'cloisonnement_2c : des lignes du registre ou du journal des effacements sans promo ni centre et plusieurs organismes : à qui sont-elles ? rien n''est changé';
  end if;
end $garde$;

-- 1. Le vocabulaire de l'étape 2c (fonctions internes : aucun droit d'exécution hors du propriétaire).

-- L'organisme unique de la base, s'il n'y en a qu'un (sinon nul) : ce qui passait avant le cloisonnement passe encore tant qu'ECF est seul.
create function public._organisme_unique()
 returns integer
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select min(o.id) from organismes o having count(*) = 1;
$function$;

-- L'organisme dans lequel l'appelant écrit et lit les lignes propres à un organisme : son organisme courant, sinon l'organisme unique.
create function public._organisme_ecriture()
 returns integer
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(organisme_courant(), _organisme_unique());
$function$;

-- L'organisme du personnel d'une adresse : son affectation siège, sinon celui de ses affectations de direction et de formateur
-- (s'il n'y en a qu'un) ; nul pour qui n'a aucune affectation.
create function public._organisme_du_personnel(p_email text)
 returns integer
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(
    (select af.organisme_id from affectations af
      where lower(af.email) = lower(p_email) and af.role = 'siege' and af.organisme_id is not null
      order by af.id limit 1),
    (select min(x.o)
       from (select case af.role when 'direction' then organisme_de_lieu(af.lieu_id) else organisme_de_promo(af.promo_id) end as o
               from affectations af
              where lower(af.email) = lower(p_email) and af.role in ('direction', 'formateur')) x
      where x.o is not null
     having count(distinct x.o) = 1));
$function$;

-- L'organisme d'un compte (spec § 5.2) : celui de ses affectations, sinon celui de la promo de sa fiche de stagiaire la plus récente,
-- sinon celui de qui l'a invité (invitation en cours : user_profiles.invited_by_email, que pose inviter_compte), sinon l'organisme unique.
create function public.organisme_de_compte(p_email text)
 returns integer
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(
    _organisme_du_personnel(p_email),
    (select organisme_de_promo(s.promo_id)
       from user_profiles up join stagiaires s on s.id = up.stagiaire_id
      where lower(up.email) = lower(p_email)
      order by s.id desc limit 1),
    (select _organisme_du_personnel(up.invited_by_email)
       from user_profiles up
      where lower(up.email) = lower(p_email) and up.invited_by_email is not null
      order by up.email limit 1),
    _organisme_unique());
$function$;

-- Vrai si l'adresse a une affectation (formateur, direction, siège) dans un autre organisme que p_organisme.
create function public._personnel_ailleurs(p_email text, p_organisme integer)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select p_organisme is not null
     and exists (select 1 from affectations a
                  where lower(a.email) = lower(p_email)
                    and coalesce(a.organisme_id, organisme_de_lieu(a.lieu_id), organisme_de_promo(a.promo_id)) <> p_organisme);
$function$;

-- Un organisme rédacteur des contenus communs (faux pour un organisme nul ou inconnu).
create function public._organisme_redacteur(p_organisme integer)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((select o.redacteur from organismes o where o.id = p_organisme), false);
$function$;

-- L'organisme d'une cible du journal des effacements (« promo n », « stagiaire n », « lieu n », « lieu n, année a ») ; nul sinon.
create function public._organisme_de_cible(p_cible text)
 returns integer
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if p_cible ~ '^promo [0-9]{1,9}$' then
    return organisme_de_promo(substr(p_cible, 7)::integer);
  end if;
  if p_cible ~ '^stagiaire [0-9]{1,9}$' then
    return (select organisme_de_promo(s.promo_id) from stagiaires s where s.id = substr(p_cible, 11)::integer);
  end if;
  if p_cible ~ '^lieu [0-9]{1,9}([^0-9]|$)' then
    return organisme_de_lieu(substring(p_cible from '^lieu ([0-9]{1,9})')::integer);
  end if;
  return null;
end;
$function$;

-- L'organisme d'une ligne propre à un organisme (registre qualité, ouverture de questionnaire) : celui qu'elle porte, sinon celui de
-- son centre, sinon celui de sa promo, sinon l'organisme unique.
create function public._organisme_ligne(p_organisme integer, p_lieu integer, p_promo integer)
 returns integer
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(p_organisme, organisme_de_lieu(p_lieu), organisme_de_promo(p_promo), _organisme_unique());
$function$;

-- 2. Les booléens appelés par les règles (avec les droits de l'appelant : ouverts à authenticated).

-- Le compte d'adresse p_email appartient à l'organisme de l'appelant : pour le fondateur, son organisme actif (fondateur_sur) ; pour
-- les autres, l'organisme de leur propre compte (leur personnel l'emporte sur une ancienne fiche de stagiaire).
create function public.compte_dans_mon_organisme(p_email text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(organisme_de_compte(p_email)
                  = case when fondateur_reel() then organisme_actif_fondateur()
                         else organisme_de_compte(lower(auth.jwt() ->> 'email')) end, false);
$function$;

-- Une ligne propre à l'organisme p_organisme se lit et s'écrit par l'appelant : c'est son organisme courant (sinon l'organisme unique).
create function public.organisme_lisible(p_organisme integer)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(p_organisme = _organisme_ecriture(), false);
$function$;

-- Une ligne du registre ou une ouverture de questionnaire est de l'organisme de l'appelant (le fondateur : son organisme actif).
create function public.ligne_lisible(p_organisme integer, p_lieu integer, p_promo integer)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select organisme_lisible(_organisme_ligne(p_organisme, p_lieu, p_promo));
$function$;

-- Une ligne du journal des effacements est de l'organisme de l'appelant : celui de sa cible, sinon celui qu'elle porte, sinon
-- l'organisme unique.
create function public.effacement_lisible(p_organisme integer, p_cible text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select organisme_lisible(coalesce(_organisme_de_cible(p_cible), p_organisme, _organisme_unique()));
$function$;

-- Une carte de Ressources s'écrit : commune (organisme nul) par le rédacteur (referentiel.modifier) ; propre à un organisme par son
-- équipe (case cours au plafond sur la promo affichée, comme referentiel.modifier avant l'étape 2c).
create function public.ressource_ecrivable(p_organisme integer)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(case when p_organisme is null then geste_promo(promo_courante(), 'referentiel.modifier')
                       else organisme_lisible(p_organisme) and case_promo(promo_courante(), 'cours') = 2 end, false);
$function$;

-- Un signalement de QCM se lit et se traite : par le fondateur sur son organisme actif ; par l'équipe de l'organisme de la ligne
-- (case cours au plafond sur la promo affichée, comme contenus.traiter avant l'étape 2c), pour un signalement sans fiche ou d'une fiche
-- de la promo affichée. Le rédacteur d'un autre organisme ne le voit pas (ni la fiche du stagiaire).
create function public.qcm_signalement_traitable(p_organisme integer, p_stagiaire_id bigint)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((est_fondateur() and fondateur_sur(p_organisme))
                  or (p_organisme = organisme_courant() and case_promo(promo_courante(), 'cours') = 2
                      and (p_stagiaire_id is null
                           or exists (select 1 from stagiaires s where s.id = p_stagiaire_id and s.promo_id = promo_courante()))), false);
$function$;

-- 3. Les déclencheurs.

-- Un membre du personnel n'appartient qu'à un organisme (spec § 5.7) : une affectation dans un autre organisme que celui des
-- affectations existantes de la même adresse est refusée. Une fiche de stagiaire n'est pas une affectation : un ancien stagiaire
-- d'un organisme peut devenir le personnel d'un autre.
create function public._personnel_un_organisme()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_o integer;
begin
  v_o := coalesce(new.organisme_id, organisme_de_lieu(new.lieu_id), organisme_de_promo(new.promo_id));
  -- Deux écritures simultanées pour une même adresse passent l'une après l'autre : verrou de la ligne du profil (la clé étrangère
  -- de l'affectation l'exige), jamais un verrou consultatif.
  perform 1 from user_profiles u where lower(u.email) = lower(new.email) for no key update;
  if v_o is not null and exists (
       select 1 from affectations a
        where lower(a.email) = lower(new.email) and a.id is distinct from new.id
          and coalesce(a.organisme_id, organisme_de_lieu(a.lieu_id), organisme_de_promo(a.promo_id)) <> v_o) then
    raise exception 'Cette adresse ne peut pas être invitée ici.' using errcode = '23514';
  end if;
  return new;
end;
$function$;

-- L'organisme d'une ligne du journal des effacements dont la cible ne le dit pas (« registre ») : celui de l'auteur (le fondateur : son
-- organisme actif), sinon l'organisme unique. Une cible qui le dit (promo, fiche, centre) fait foi : la colonne reste nulle.
create function public._effacements_journal_organisme()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  new.organisme_id := case when _organisme_de_cible(new.cible) is null
                           then coalesce(new.organisme_id, organisme_courant(), _organisme_unique()) end;
  return new;
end;
$function$;

-- Une ligne de planning, de passage, de signature de formateur ou d'évaluation EPCF ne cite qu'une fiche profs de l'organisme de sa
-- promo (prof_id, prof_ids, evaluateur_prof_id) : une fiche d'un autre organisme est traitée comme absente (« Fiche formateur
-- introuvable. », 23514). Jugé à l'insertion, et à la modification quand les fiches citées ou la promo changent.
create function public._profs_de_l_organisme()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_n jsonb := to_jsonb(new);
  v_a jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_ids integer[];
begin
  if tg_op = 'UPDATE' and v_n -> 'promo_id' = v_a -> 'promo_id'
     and (v_n -> 'prof_id') is not distinct from (v_a -> 'prof_id') and (v_n -> 'prof_ids') is not distinct from (v_a -> 'prof_ids')
     and (v_n -> 'evaluateur_prof_id') is not distinct from (v_a -> 'evaluateur_prof_id') then
    return new;
  end if;
  v_ids := array(select (x.v)::integer from (
                   select v_n ->> 'prof_id' as v
                   union all select v_n ->> 'evaluateur_prof_id'
                   union all select jsonb_array_elements_text(case when jsonb_typeof(v_n -> 'prof_ids') = 'array' then v_n -> 'prof_ids' else '[]'::jsonb end)) x
                 where x.v is not null);
  -- Un identifiant sans fiche (fiche supprimée) reste accepté, comme avant : seule une fiche d'un autre organisme est refusée.
  if exists (select 1 from profs pf
              where pf.id = any (v_ids) and pf.organisme_id is distinct from organisme_de_promo((v_n ->> 'promo_id')::integer)) then
    raise exception 'Fiche formateur introuvable.' using errcode = '23514';
  end if;
  return new;
end;
$function$;

revoke all on function public._organisme_unique(), public._organisme_ecriture(), public._organisme_du_personnel(text),
  public.organisme_de_compte(text), public._personnel_ailleurs(text, integer), public._organisme_redacteur(integer),
  public._organisme_de_cible(text), public.compte_dans_mon_organisme(text), public.organisme_lisible(integer),
  public.ressource_ecrivable(integer), public.qcm_signalement_traitable(integer, bigint), public._personnel_un_organisme(),
  public._effacements_journal_organisme(), public._organisme_ligne(integer, integer, integer),
  public.ligne_lisible(integer, integer, integer), public.effacement_lisible(integer, text), public._profs_de_l_organisme()
  from public, anon, authenticated, service_role;
grant execute on function public.compte_dans_mon_organisme(text), public.organisme_lisible(integer),
  public.ressource_ecrivable(integer), public.qcm_signalement_traitable(integer, bigint),
  public.ligne_lisible(integer, integer, integer), public.effacement_lisible(integer, text) to authenticated;

-- 4. Les colonnes, les unicités et les déclencheurs des tables.

-- Personnel : un seul organisme par adresse (après organisme_par_defaut, qui remplit l'organisme d'un siège).
create trigger personnel_un_organisme before insert or update of email, role, promo_id, lieu_id, organisme_id on public.affectations
  for each row execute function public._personnel_un_organisme();

-- Registre qualité : l'organisme d'une entrée sans promo ni centre (spec § 5.2 : celui de son auteur) ; une entrée avec promo ou
-- centre n'en porte pas (celui de son centre fait foi). L'existant sans promo ni centre rejoint l'organisme unique (le déclencheur
-- d'écriture du registre, qui date chaque modification, est suspendu le temps du remplissage ; il pose ensuite l'organisme, voir
-- _registre_qualite_avant plus bas). Ni clé étrangère ni déclencheur de plus (la forme du registre reste celle du lot Q4) : la
-- colonne n'est écrite que par ce déclencheur, avec un organisme existant.
alter table public.registre_qualite add column organisme_id integer;
alter table public.registre_qualite disable trigger registre_qualite_avant;
update public.registre_qualite r set organisme_id = public._organisme_unique() where r.promo_id is null and r.lieu_id is null;
alter table public.registre_qualite enable trigger registre_qualite_avant;

-- Journal des effacements : l'organisme d'une ligne dont la cible ne le dit pas (« registre ») ; l'existant rejoint l'organisme unique.
alter table public.effacements_journal add column organisme_id integer;
update public.effacements_journal j set organisme_id = public._organisme_unique() where public._organisme_de_cible(j.cible) is null;
create trigger effacements_journal_organisme before insert on public.effacements_journal
  for each row execute function public._effacements_journal_organisme();

-- Planning : une fiche profs citée par une ligne est de l'organisme de sa promo (après les déclencheurs qui imposent la promo du
-- stagiaire, d'où le nom).
create trigger verif_profs_organisme before insert or update on public.planning_entries
  for each row execute function public._profs_de_l_organisme();
create trigger verif_profs_organisme before insert or update on public.passages
  for each row execute function public._profs_de_l_organisme();
create trigger verif_profs_organisme before insert or update on public.emargement_formateurs
  for each row execute function public._profs_de_l_organisme();
create trigger verif_profs_organisme before insert or update on public.epcf_evaluations
  for each row execute function public._profs_de_l_organisme();

-- Planning : le nom d'une fiche profs est unique dans un organisme, plus dans toute la base.
alter table public.profs drop constraint profs_nom_key;
create unique index profs_organisme_nom on public.profs (organisme_id, nom) nulls not distinct;

-- Ressources : l'organisme se pose à l'insertion seulement ; une carte peut ensuite devenir commune (organisme nul).
drop trigger organisme_par_defaut on public.ressources;
create trigger organisme_par_defaut before insert on public.ressources
  for each row when (new.organisme_id is null) execute function public._organisme_par_defaut();

-- 5. Les fonctions remplacées (corps de l'état de la production du 27/11 avec les étapes 1, 2a et 2b, modifiés là où il le faut).

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
  v_brut text;
  v_entete text;
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
  -- Sans en-tête x-promo-id, le personnel (siège, direction, formateur) l'emporte sur une ancienne fiche de stagiaire (spec § 5.7 :
  -- un ancien stagiaire d'un organisme devenu personnel d'un autre) ; un en-tête x-promo-id garde la promo qu'il désigne.
  v_brut := nullif(current_setting('request.headers', true), '');
  if v_brut is not null then
    if pg_input_is_valid(v_brut, 'jsonb') then
      v_entete := nullif(v_brut::jsonb ->> 'x-promo-id', '');
    end if;
  end if;
  if v_entete is null then
    v_o := _organisme_du_personnel(v_moi);
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
  ), perso as (
    -- L'organisme du personnel (hors fondateur) : sa promo par défaut y est prise, jamais celle d'une ancienne fiche de stagiaire
    -- d'un autre organisme (spec § 5.7).
    select case when fondateur_reel() then null else _organisme_du_personnel(lower((select auth.jwt() ->> 'email'))) end as o
  )
  select coalesce(
    (select s.promo_id from moi join stagiaires s on s.id = moi.stagiaire_id cross join perso
      where peut_acceder_promo(s.promo_id) and (perso.o is null or organisme_de_promo(s.promo_id) = perso.o)),
    (select pr.id from promos pr cross join perso
      where peut_acceder_promo(pr.id) and (pr.date_fin is null or pr.date_fin >= current_date)
        and (perso.o is null or organisme_de_promo(pr.id) = perso.o)
      order by pr.date_debut, pr.id limit 1),
    (select pr.id from promos pr cross join perso
      where peut_acceder_promo(pr.id) and (perso.o is null or organisme_de_promo(pr.id) = perso.o)
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
    -- Contenus communs (cours, QCM, référentiel) : seulement depuis une promo d'un organisme rédacteur (la promo donnée, sinon
    -- l'organisme courant) ou par la case cours du siège (case_reseau, elle-même nulle hors d'un organisme rédacteur).
    -- Le fondateur (hors aperçu) écrit les contenus communs quel que soit son organisme actif : ils n'appartiennent à aucun client
    -- (spec § 5.2, comme cours_modification par est_fondateur()) ; sur une promo donnée seulement (promo nulle : comme avant).
    when 'contenus.lire_internes' then
      return coalesce((est_fondateur() and p is not null) or ((case_promo(p, 'cours') >= 1 or direction_fixe(l))
                       and _organisme_redacteur(coalesce(organisme_de_promo(p), organisme_courant())))
                      or case_reseau('cours') >= 1, false);
    when 'contenus.rediger' then
      return coalesce((est_fondateur() and p is not null) or (case_promo(p, 'cours') = 2 and _organisme_redacteur(coalesce(organisme_de_promo(p), organisme_courant())))
                      or case_reseau('cours') = 2, false);
    when 'referentiel.modifier' then
      return coalesce((est_fondateur() and p is not null) or case_promo(p, 'cours') = 2 and _organisme_redacteur(coalesce(organisme_de_promo(p), organisme_courant())), false);
    when 'contenus.traiter' then
      return coalesce((est_fondateur() and p is not null) or case_promo(p, 'cours') = 2 and _organisme_redacteur(coalesce(organisme_de_promo(p), organisme_courant())), false);
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
  -- La page cours (contenus communs) : seulement dans un organisme rédacteur.
  select case when p_page = 'cours' and not organisme_redacteur_courant() then 0 else coalesce((
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
  ), 0) end;
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
    -- Un membre du personnel n'appartient qu'à un organisme (spec § 5.7) : refus avant toute écriture.
    if _personnel_ailleurs(v_email, organisme_de_promo(v_promo)) then
      raise exception 'Cette adresse ne peut pas être invitée ici.' using errcode = '23514';
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
    -- Un membre du personnel n'appartient qu'à un organisme (spec § 5.7) : refus avant toute écriture.
    if _personnel_ailleurs(v_email, organisme_de_lieu(p_lieu_id)) then
      raise exception 'Cette adresse ne peut pas être invitée ici.' using errcode = '23514';
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
    -- Un membre du personnel n'appartient qu'à un organisme (spec § 5.7) : refus avant toute écriture.
    if _personnel_ailleurs(v_email, v_o) then
      raise exception 'Cette adresse ne peut pas être invitée ici.' using errcode = '23514';
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
  -- Un membre du personnel n'appartient qu'à un organisme (spec § 5.7) : refus avant toute écriture (une adresse siège d'un autre
  -- organisme recevait jusqu'ici un succès sans rien écrire).
  if _personnel_ailleurs(v_email, case when t.niveau = 'reseau'
                                       then coalesce((select ti.organisme_id from titres ti where ti.id = v_titre_id), organisme_courant())
                                       else organisme_de_lieu(v_lieu) end) then
      raise exception 'Cette adresse ne peut pas être invitée ici.' using errcode = '23514';
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
  -- Une fiche profs de l'organisme de l'appelant seulement (une fiche d'un autre organisme est traitée comme absente).
  select pf.id into v_prof from profs pf
   where pf.id = p_prof_id and pf.organisme_id = _organisme_ecriture()
     and not exists (select 1 from user_profiles u where u.prof_id = pf.id);
  -- Rien n'est retiré à un compte déjà affecté : is_admin ne passe jamais de vrai à faux, invited_by_email n'est jamais réécrit
  -- (posé seulement s'il manque), la fiche formateur n'est posée que si le profil n'en a pas. Un ancien stagiaire d'un autre
  -- organisme : l'adresse de qui l'avait invité (le personnel de cet organisme) est remplacée par celle du nouvel inviteur.
  update user_profiles u
     set role = 'prof', is_admin = u.is_admin or p_admin, prof_id = coalesce(u.prof_id, v_prof),
         invited_by_email = case when organisme_de_compte(u.email) is distinct from _organisme_ecriture() then p_par
                                 else coalesce(u.invited_by_email, p_par) end,
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
  -- La fiche formateur n'est posée que si elle existe, est de l'organisme de l'appelant et n'est reliée à aucun compte.
  select pf.id into v_prof from profs pf
   where pf.id = p_prof_id and pf.organisme_id = _organisme_ecriture()
     and not exists (select 1 from user_profiles u where u.prof_id = pf.id);
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
  select t.niveau, t.lieu_id, t.organisme_id into v_titre from public.titres t where t.id = new.titre_id;
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
  -- Défense : un titre du réseau d'un organisme ne sert qu'à cet organisme (affectation siège posée sur un autre organisme, centre
  -- d'un autre organisme). Un siège sans organisme encore posé le prend du titre (organisme_par_defaut, qui suit).
  if v_titre.organisme_id is not null
     and ((new.role = 'siege' and new.organisme_id is not null and new.organisme_id <> v_titre.organisme_id)
          or (v_lieu is not null and public.organisme_de_lieu(v_lieu) is distinct from v_titre.organisme_id)) then
    raise exception 'titres: Ce titre appartient à un autre organisme.' using errcode = '23514';
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
  v_o integer;
begin
  new.lieux_partages := coalesce(array(select distinct x from unnest(new.lieux_partages) x
                                         where x is not null and x is distinct from new.lieu_id order by x), '{}'::integer[]);
  -- L'organisme de la fiche : celui de son centre, sinon celui de son compte, sinon l'organisme de l'appelant. Un centre de partage
  -- d'un autre organisme est traité comme inconnu.
  v_o := coalesce(organisme_de_lieu(new.lieu_id), organisme_de_compte(new.compte_email), _organisme_ecriture());
  if exists (select 1 from unnest(new.lieux_partages) x
              where not exists (select 1 from lieux li where li.id = x and li.organisme_id is not distinct from v_o)) then
    raise exception 'contact: Centre inconnu.';
  end if;
  if lower(auth.jwt() ->> 'email') is not null and not (est_fondateur() and fondateur_sur(v_o)) then
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
    -- Une fiche profs d'un autre organisme est traitée comme absente du planning.
    if not exists (select 1 from profs pf where pf.id = new.prof_id and pf.organisme_id is not distinct from v_o) then
      raise exception 'contact: Ce formateur ne figure pas au planning de ce centre.' using errcode = '42501';
    end if;
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
           when c.compte_email is null then coalesce((l = c.lieu_id or l = any(c.lieux_partages))
                                                     and organisme_de_lieu(l) is not distinct from coalesce(organisme_de_lieu(c.lieu_id), organisme_de_lieu(l)), false)
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
    -- Les centres de l'organisme du personnel de l'adresse seulement.
    select y.l from (
      select p.lieu_id as l from affectations a join promos p on p.id = a.promo_id
       where a.role = 'formateur' and lower(a.email) = lower(p_email)
      union
      select a.lieu_id from affectations a where a.role = 'direction' and lower(a.email) = lower(p_email) and a.lieu_id is not null) y
     where organisme_de_lieu(y.l) = _organisme_du_personnel(lower(p_email))
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
    left join profs pf on pf.id = c.prof_id and pf.organisme_id = organisme_de_lieu(x.l)
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
                                 and pf.organisme_id is not distinct from coalesce(_organisme_du_personnel(v_moi), pf.organisme_id)
     where c.compte_email = v_moi;
  end if;
  return jsonb_build_object(
    'fiche', v_fiche,
    'email_compte', v_moi,
    'peut_ecrire', coalesce(geste_promo(promo_courante(), 'fiches_internes.ecrire'), false),
    'centres', case when v_fiche is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', li.id, 'nom', li.nom) order by li.nom collate "C", li.id)
        from lieux li
       where li.organisme_id = _organisme_du_personnel(v_moi)
         and li.id in (select p.lieu_id from affectations a join promos p on p.id = a.promo_id
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
                   from registre_qualite r
                  where fondateur_sur(_organisme_ligne(r.organisme_id, r.lieu_id, r.promo_id))));
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
  if p_lieu is null or not ((peut_gerer_qualite() and (organisme_de_lieu(p_lieu) is null or fondateur_sur(organisme_de_lieu(p_lieu))))
                           or _peut_conserver_centre(p_lieu)) then
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
   where etat = 'clos' and efface_le is null and clos_le + interval '3 years' < now()
     and fondateur_sur(_organisme_ligne(organisme_id, lieu_id, promo_id));
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
  if v_portee.promo_id is not null and not exists (select 1 from promos where id = v_portee.promo_id and fondateur_sur(organisme_de_promo(id))) then
    raise exception 'questionnaire: Promo introuvable.';
  end if;
  if v_portee.lieu_id is not null and not exists (select 1 from lieux where id = v_portee.lieu_id and fondateur_sur(organisme_id)) then
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
  -- Une promo ou un lieu d'un autre organisme que l'organisme actif du fondateur : refusé.
  if coalesce(organisme_de_promo(v_portee.promo_id), organisme_de_lieu(v_portee.lieu_id)) is not null
     and not fondateur_sur(coalesce(organisme_de_promo(v_portee.promo_id), organisme_de_lieu(v_portee.lieu_id))) then
    raise exception 'questionnaire: Réservé à la gestion de la qualité.';
  end if;

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
  -- Une promo ou un lieu d'un autre organisme que l'organisme actif du fondateur : refusé.
  if coalesce(organisme_de_promo(v_portee.promo_id), organisme_de_lieu(v_portee.lieu_id)) is not null
     and not fondateur_sur(coalesce(organisme_de_promo(v_portee.promo_id), organisme_de_lieu(v_portee.lieu_id))) then
    raise exception 'questionnaire: Réservé à l''éditeur.';
  end if;
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
     and ((est_fondateur() and fondateur_sur(organisme_de_promo(s.promo_id))) or geste_promo(s.promo_id, 'stagiaires.lire'))
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
  -- Une fiche d'un autre organisme que l'organisme actif du fondateur est traitée comme introuvable.
  if exists (select 1 from stagiaires s where s.id = p_stagiaire and not fondateur_sur(organisme_de_promo(s.promo_id))) then
    raise exception 'autonomie: Fiche introuvable.';
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

  -- Organisme (cloisonnement, étape 2c) : une entrée sans promo ni centre porte celui de son auteur (le fondateur : son organisme
  -- actif), posé à la création et gardé ensuite ; une entrée avec promo ou centre n'en porte pas (celui de son centre fait foi).
  if new.promo_id is not null or new.lieu_id is not null then
    new.organisme_id := null;
  elsif tg_op = 'INSERT' then
    new.organisme_id := coalesce(new.organisme_id, organisme_courant(), _organisme_unique());
    if new.organisme_id is null then
      raise exception 'registre: Organisme introuvable pour cette entrée.' using errcode = '22023';
    end if;
  else
    new.organisme_id := coalesce(new.organisme_id, old.organisme_id);
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

CREATE OR REPLACE FUNCTION public._contact_annexes(l integer, p integer, p_jours jsonb, p_auteur integer)
 RETURNS TABLE(fiche_id bigint, stagiaire_id integer, nom text, annexe text, non_prevenu text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with demis as (
    select (e ->> 'jour')::date as d, e ->> 'demi' as demi from jsonb_array_elements(coalesce(p_jours, '[]'::jsonb)) e
  ), pe as (
    select x.prof_id, x.prof_ids, x.prof_autre
      from demis
      join planning_entries x on x.promo_id = p and x.half_day = demis.demi
                             and x.semaine_lundi = demis.d - (extract(isodow from demis.d)::integer - 1)
                             and x.day_index = extract(isodow from demis.d)::integer - 1
  ), profs_du_jour as (
    select distinct u.id from pe cross join lateral unnest(array[pe.prof_id] || pe.prof_ids) u(id) where u.id is not null
  ), fiches as (
    select f as id from _contact_formateurs_du_jour(l, p, p_jours) f
  ), tout as (
    select c.id as fiche_id, null::integer as stagiaire_id, _contact_nom_fiche(c, l) as nom, 'formateur_du_jour' as annexe, null::text as non_prevenu
      from contacts c where c.id in (select id from fiches)
    union all
    select null::bigint, null::integer, n.nom, 'formateur_du_jour', n.nom
      from (select btrim(pe.prof_autre) as nom from pe where nullif(btrim(pe.prof_autre), '') is not null
            union
            select coalesce(nullif(btrim(pf.nom), ''), 'Formateur') from profs pf
             where pf.id in (select id from profs_du_jour) and pf.organisme_id = organisme_de_lieu(l)
               and not exists (select 1 from contacts c where c.prof_id = pf.id and _contact_disponible(c, l, _contact_jour()))) n
    union all
    select null::bigint, st.id, coalesce(_contact_nom_stagiaire(st.id), 'Délégué'), 'delegue', null::text
      from stagiaires st
     where st.promo_id = p and st.delegue is not null and st.id is distinct from p_auteur
       and st.actif and st.efface_le is null and st.anonymise_le is null
       and exists (select 1 from user_profiles up where up.stagiaire_id = st.id)
  )
  select * from tout order by annexe desc, nom, fiche_id, stagiaire_id;
$function$
;

CREATE OR REPLACE FUNCTION public._contact_nom_fiche(c contacts, l integer)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce((select pf.nom from profs pf where pf.id = c.prof_id and pf.organisme_id = organisme_de_lieu(l)), nullif(btrim(concat_ws(' ', c.prenom, c.nom)), ''),
                  case when c.compte_email is null then c.role end,
                  (select string_agg(distinct ti.nom, ', ' order by ti.nom) from affectations a join titres ti on ti.id = a.titre_id
                    where lower(a.email) = c.compte_email
                      and ((a.role = 'formateur' and a.promo_id in (select p.id from promos p where p.lieu_id = l))
                           or (a.role = 'direction' and a.lieu_id = l))));
$function$
;

CREATE OR REPLACE FUNCTION public.annuaire_centre()
 RETURNS TABLE(id bigint, avec_compte boolean, nom_affiche text, titres jsonb, libelle text, pour_quoi text, note text, quand text, telephone text, email text, verifiee boolean, conge_du date, conge_au date, relais_id bigint, prof_id integer, ordre integer, moi boolean, ecrivable boolean, joignable boolean, prenom text, nom text, lieux_partages integer[], categorie text, depart_le date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with ctx as (
    select lieu_courant() as l,
           coalesce(geste_promo(promo_courante(), 'fiches_internes.ecrire'), false) as ecrit,
           lower(auth.jwt() ->> 'email') as moi,
           (now() at time zone 'Europe/Paris')::date as jour
  ), f as (
    select c.*, x.l as centre, x.moi as appelant,
           (c.compte_email is null and c.lieu_id = x.l and x.ecrit) as peut_ecrire,
           (c.compte_email is null or c.verifiee_le is not null) as verif,
           (c.depart_le is not null and c.depart_le < x.jour) as parti
      from ctx x
      join contacts c on _contact_fiche_dans(c, x.l)
     where x.l is not null
  )
  , r as (
  select f.id,
         f.compte_email is not null as avec_compte,
         coalesce(pf.nom, nullif(btrim(concat_ws(' ', f.prenom, f.nom)), ''), t.noms) as nom_affiche,
         coalesce(t.titres, '[]'::jsonb),
         case when f.compte_email is null then f.role end,
         case when f.verif then f.pour_quoi end,
         f.note,
         case when f.verif then f.quand end,
         case when f.verif then f.phone end,
         case when f.verif then f.email end,
         f.verif,
         f.conge_du, f.conge_au, f.relais_id, f.prof_id, f.sort_order as ordre,
         coalesce(f.compte_email = f.appelant, false),
         f.peut_ecrire,
         f.compte_email is not null or f.email is not null,
         case when f.peut_ecrire then f.prenom end,
         case when f.peut_ecrire then f.nom end,
         case when f.peut_ecrire then f.lieux_partages end,
         case when f.peut_ecrire then f.category end,
         case when f.peut_ecrire then f.depart_le end
    from f
    left join profs pf on pf.id = f.prof_id and pf.organisme_id = organisme_de_lieu(f.centre)
    left join lateral (
      select jsonb_agg(jsonb_build_object('nom', g.nom, 'niveau', g.niveau, 'promos', g.promos) order by g.nom collate "C") as titres,
             string_agg(g.nom, ', ' order by g.nom collate "C") as noms
        from (select ti.nom, ti.niveau,
                     coalesce(jsonb_agg(distinct a.promo_id) filter (where a.promo_id is not null), '[]'::jsonb) as promos
                from affectations a
                join titres ti on ti.id = a.titre_id
               where f.compte_email is not null and lower(a.email) = f.compte_email
                 and ((a.role = 'formateur' and a.promo_id in (select p.id from promos p where p.lieu_id = f.centre))
                      or (a.role = 'direction' and a.lieu_id = f.centre))
               group by ti.id, ti.nom, ti.niveau) g
    ) t on true
   where not f.parti or f.peut_ecrire
  )
  select r.* from r order by r.ordre, r.nom_affiche collate "C", r.id;
$function$
;
-- 6. Les règles.

-- Personnel : on ne lit que le personnel de son organisme (le fondateur : de son organisme actif).
alter policy user_profiles_lecture on public.user_profiles using (
  (lower(email) = lower((select auth.jwt() ->> 'email')))
  or ((stagiaire_id is null) and (role <> 'stagiaire')
      and ((select _contact_compte_equipe()) or (select geste_reseau('directions.lire')) or (select est_fondateur()))
      and compte_dans_mon_organisme(email))
  or ((stagiaire_id is null) and (role = 'stagiaire')
      and (((select est_fondateur()) and compte_dans_mon_organisme(email))
           or (lower(invited_by_email) = lower((select auth.jwt() ->> 'email')))))
  or ((stagiaire_id in (select s.id from stagiaires s where s.promo_id = (select promo_courante())))
      and (select geste_promo((select promo_courante()), 'stagiaires.lire'))));
alter policy user_profiles_suppression on public.user_profiles using (
  (not is_founder) and (not a_une_affectation(email))
  and (((stagiaire_id in (select s.id from stagiaires s where s.promo_id = (select promo_courante())))
        and (select geste_promo((select promo_courante()), 'stagiaires.gerer')))
       or ((stagiaire_id is null) and (role = 'stagiaire')
           and (((select est_fondateur()) and compte_dans_mon_organisme(email))
                or ((select geste_promo((select promo_courante()), 'stagiaires.gerer'))
                    and (lower(invited_by_email) = lower((select auth.jwt() ->> 'email'))))))
       or ((stagiaire_id is null) and (role <> 'stagiaire') and (select est_fondateur()) and compte_dans_mon_organisme(email))));
alter policy conditions_acceptations_lecture on public.conditions_acceptations using (
  (lower(email) = lower((select auth.jwt() ->> 'email')))
  or ((select est_fondateur()) and compte_dans_mon_organisme(email))
  or ((select geste_promo((select promo_courante()), 'stagiaires.lire'))
      and (lower(email) in (select lower(u.email) from user_profiles u
                             where u.stagiaire_id in (select s.id from stagiaires s where s.promo_id = (select promo_courante()))))));
alter policy effacements_journal_lecture on public.effacements_journal using (
  ((select est_fondateur()) and effacement_lisible(organisme_id, cible))
  or ((select geste_promo((select promo_courante()), 'stagiaires.lire'))
      and ((cible = ('promo ' || (select promo_courante()))) or (cible = ('lieu ' || (select lieu_courant())))
           or (cible in (select ('stagiaire ' || s.id) from stagiaires s where s.promo_id = (select promo_courante()))))));

-- Qualité et conservation : le fondateur, sur l'organisme de la ligne seulement.
alter policy registre_qualite_lecture on public.registre_qualite using (
  (select peut_gerer_qualite()) and ligne_lisible(organisme_id, lieu_id, promo_id));
alter policy registre_qualite_ajout on public.registre_qualite with check (
  (select peut_gerer_qualite()) and ligne_lisible(organisme_id, lieu_id, promo_id));
alter policy registre_qualite_modification on public.registre_qualite
  using ((select peut_gerer_qualite()) and ligne_lisible(organisme_id, lieu_id, promo_id))
  with check ((select peut_gerer_qualite()) and ligne_lisible(organisme_id, lieu_id, promo_id));
alter policy questionnaire_ouvertures_select on public.questionnaire_ouvertures using (
  (select peut_gerer_qualite()) and ligne_lisible(null::integer, lieu_id, promo_id));

-- Planning : les fiches profs de son organisme.
alter policy profs_select_all on public.profs using (organisme_lisible(organisme_id));
alter policy profs_ecriture on public.profs
  using ((select geste_promo((select promo_courante()), 'fiches_internes.ecrire')) and organisme_lisible(organisme_id))
  with check ((select geste_promo((select promo_courante()), 'fiches_internes.ecrire')) and organisme_lisible(organisme_id));

-- Ressources : une carte commune se lit par tous et s'écrit par le rédacteur ; une carte d'un organisme, par lui seul.
alter policy ressources_select_all on public.ressources using ((organisme_id is null) or organisme_lisible(organisme_id));
alter policy ressources_ecriture on public.ressources
  using (ressource_ecrivable(organisme_id))
  with check (ressource_ecrivable(organisme_id));

-- Signalements de QCM : l'équipe de l'organisme de la ligne ; un signalement écrit porte l'organisme de son auteur.
alter policy qcm_signalements_insert on public.qcm_signalements with check (
  (lower(email) = lower(auth.email())) and organisme_lisible(organisme_id));
alter policy qcm_signalements_lecture on public.qcm_signalements using (
  (lower(email) = lower((select auth.jwt() ->> 'email'))) or qcm_signalement_traitable(organisme_id, stagiaire_id));
alter policy qcm_signalements_modification on public.qcm_signalements
  using (qcm_signalement_traitable(organisme_id, stagiaire_id))
  with check (qcm_signalement_traitable(organisme_id, stagiaire_id));
alter policy qcm_signalements_suppression on public.qcm_signalements using (qcm_signalement_traitable(organisme_id, stagiaire_id));
