-- Conservation des données à 3 ans (Qualiopi, lot Q5), partie fiches et émargement (tâche 2 du plan
-- docs/superpowers/plans/2026-11-09-qualiopi-q5-conservation.md ; spec docs/superpowers/specs/2026-11-08-qualiopi-q3-q5-design.md,
-- § 6, § 6.1, § 10), complétée par la tâche 3 (questionnaires, section 10) et la tâche 4 (registre qualité, section 11).
-- Retour : 20261110_conservation_retour.sql. Preuve : tests/sql/conservation-preuve.sql (schéma minimal :
-- tests/sql/conservation-schema-minimal.sql). NON APPLIQUÉE : attend l'accord de Timy, et s'applique avec le commit de
-- l'app des tâches 6-7 (sinon les boutons des Paramètres appellent des fonctions supprimées).
--
-- Avant ce lot, _anonymiser_stagiaire faisait tout d'un coup, 12 mois après la fin de la promo, et passait la fiche en
-- abandon (actif = false). Ce lot la remplace par deux étapes datées et un effacement sur demande :
--   - Étape 1 (à partir de date_fin + 12 mois) : compte, e-mails, date de naissance, fiche de suivi, textes libres,
--     observations de l'émargement et e-mails de la personne sur l'émargement. Le nom, les résultats, le dossier
--     professionnel, le livret et les tracés des signatures restent. Marque : stagiaires.efface_le. Les e-mails de la
--     personne sont ceux de son compte et, compte déjà retiré par l'équipe, ceux qu'elle a laissés sur sa fiche : lignes
--     d'émargement signées sur son propre appareil (signe_par), signalements de questions faits depuis sa fiche. Une
--     adresse retrouvée ainsi qui sert encore à un compte (profil d'une autre fiche, équipe) n'est retirée que des lignes
--     de cette fiche (émargement, évaluations, signalements).
--   - Étape 2 (à partir du 1er janvier de l'année date_fin + 4, soit après le 31/12 de la 3e année) : l'étape 1 si elle
--     manque (sinon ses textes libres de nouveau, écrits depuis par un formateur sur la fiche encore nommée), puis
--     dossier professionnel, livret, tracés des signatures, nom (prénom « Anonyme <id> », nom nul). Marque :
--     stagiaires.anonymise_le, qui garde son sens (plus aucun nom). Pour les feuilles d'émargement de la promo : les
--     formateurs deviennent « Formateur 1 », « Formateur 2 »… par feuille dans l'ordre de leur signature, sans fiche
--     formateur ni tracé ; les e-mails des feuilles (ouverture, clôture, signataires, mises à jour) deviennent « anonyme ».
--     L'heure, la présence et le total d'heures restent : une ligne dont le tracé est effacé reste signée (signe_le).
--   - Sur demande de la personne : les deux étapes tout de suite, sans condition de date ni d'abandon. La demande se lit au
--     journal (type « demande », cible « stagiaire <id> »), jamais dans une colonne de stagiaires que toute la promo lit.
-- Aucune étape n'écrit actif : l'abandon reste une décision de l'équipe. Aucun effacement ne part tout seul : chaque
-- fonction est un clic du fondateur, rejouable (un second appel ne change rien et n'écrit rien au journal). Une fiche
-- reliée à un compte d'équipe (affectation, is_admin, is_founder) n'est jamais effacée : les étapes de promo la sautent
-- et la comptent, l'effacement sur demande la refuse.
-- Droits : chaque fonction appelable exige peut_gerer_qualite() (le fondateur réel, hors aperçu, lot Q3) ET l'accès à
-- la promo (peut_acceder_promo), pour que l'élargissement du lot 5 à la direction ne laisse pas un centre effacer un
-- autre ; etat_conservation() ne liste que les promos accessibles. Les deux fonctions internes n'ont aucun droit
-- d'appel pour les rôles de l'API. Le jour est celui de Paris (_questionnaire_jour(), lot Q3).
-- Émargement : sa protection (déclencheur emargement_signature_figee) se lève par set_config('emargement.effacement',
-- 'on', true), remis à vide juste après chaque écriture. Les marques efface_le et anonymise_le ont la même protection
-- (déclencheur stagiaires_marques_conservation, drapeau conservation.effacement). Une fiche sans nom ne signe plus, n'est plus annotée et ne
-- reçoit plus d'absence à la clôture.
-- Les anciennes fonctions anonymiser_promo, anonymiser_stagiaire, etat_anonymisation_promo et _anonymiser_stagiaire sont
-- supprimées (le retour les recrée), versions à argument de la direction comprises (anonymiser_promo(p_promo) et
-- etat_anonymisation_promo(p_promo), 20261111_espaces_4_donnees.sql : elles appelaient _anonymiser_stagiaire et anonymisaient à
-- 12 mois). La conservation des fiches reste au fondateur, sur la page Qualiopi (question 3 du plan) ; la direction garde la
-- purge des élèves bénévoles de son centre (benevoles_a_purger(p_lieu), purger_benevoles(p_ids, p_lieu)). Une fiche déjà anonymisée par l'ancien bouton reçoit efface_le = anonymise_le.
-- Questionnaires (tâche 3, spec § 6.1 ; question 1 du plan : notes gardées 3 ans, puis pourcentages seulement) :
--   - Stagiaires : à l'étape 1 de la promo, les commentaires libres des deux questionnaires de la promo sont effacés et
--     les réponses rebrassées (nouvel identifiant, réécriture dans un ordre tiré au hasard, comme à chaque envoi) ; à
--     l'étape 2, les comptes par question (à partir du seuil seulement, comme resultats_questionnaire) sont figés dans
--     questionnaire_resultats_figes, puis les réponses et les participations de la promo sont supprimées. Sous le seuil,
--     seule la marque « figé » reste, sans aucun compte. À partir de la date de l'étape 1, les deux questionnaires de la
--     promo sont fermés pour de bon, ouverture manuelle comprise.
--   - Formateurs (portée : lieu et année) : à partir du 01/01 de l'année suivante, la clôture efface la liste de ceux
--     qui ont répondu et ferme l'année pour de bon (questionnaire_clotures) ; à partir du 31/12 de l'année suivante,
--     les commentaires ; à partir du 01/01 de la 4e année, le figeage. Chaque fonction fait au passage la clôture si
--     elle manque.
--   - Participations : rattachées aussi à la fiche (stagiaire_id, une par fiche), pour refuser une deuxième réponse
--     après un compte supprimé puis recréé ; un compte supprimé laisse la ligne, sans compte. Elles partent avec l'étape
--     1 de la fiche (ou la demande de la personne), ou avec le figeage de la portée.
--   - Limite (question 6 du plan ; remplace celle de 20261108_questionnaires.sql) : un formateur n'a pas de fiche. Si
--     son compte est supprimé puis recréé dans la même année, il peut répondre une seconde fois au questionnaire des
--     formateurs de son lieu. Cas rare, sans enjeu sur les pourcentages ; écrit au registre des traitements.
--   - Toute réécriture des réponses prend le verrou par portée de repondre_questionnaire. Fonctions internes : aucun
--     droit d'appel pour les rôles de l'API ; tables nouvelles : aucun droit et aucune règle de lecture.
-- Refus en « conservation: <phrase> » (ou « questionnaire: <phrase> » dans les fonctions des questionnaires), la phrase
-- étant montrée telle quelle par l'app.
set local lock_timeout = '3s';

-- 1. Marques et contraintes ----------------------------------------------------------------------------------------
alter table public.stagiaires add column efface_le timestamptz;
update public.stagiaires set efface_le = anonymise_le where anonymise_le is not null and efface_le is null;
alter table public.stagiaires
  add constraint stagiaires_efface_avant_anonyme check (anonymise_le is null or efface_le is not null);
-- Les deux marques décident seules de ce qui reste à effacer : personne ne les pose ni ne les retire en direct (l'équipe
-- de la promo peut sinon modifier toute colonne de stagiaires, règle stagiaires_modification du lot 4). Seules les
-- fonctions de conservation les écrivent, sous set_config('conservation.effacement', 'on', true), remis à vide juste
-- après. Une fiche ne naît pas non plus marquée.
create function public._stagiaires_marques_conservation()
returns trigger language plpgsql set search_path to 'public', 'pg_temp' as $function$
begin
  if coalesce(current_setting('conservation.effacement', true), '') = 'on' then
    return new;
  end if;
  if (tg_op = 'INSERT' and (new.efface_le is not null or new.anonymise_le is not null))
     or (tg_op = 'UPDATE' and (new.efface_le is distinct from old.efface_le
                               or new.anonymise_le is distinct from old.anonymise_le)) then
    raise exception 'conservation: Les marques d''effacement d''une fiche ne se posent et ne se retirent que par la conservation des données.';
  end if;
  return new;
end;
$function$;
revoke all on function public._stagiaires_marques_conservation() from public, anon, authenticated, service_role;
create trigger stagiaires_marques_conservation before insert or update on public.stagiaires
  for each row execute function public._stagiaires_marques_conservation();

-- Émargement : un tracé effacé laisse l'heure et le signataire (« anonyme »), et dit quand il a été effacé.
alter table public.emargement_lignes add column signature_effacee_le timestamptz;
alter table public.emargement_lignes drop constraint emargement_lignes_check;
alter table public.emargement_lignes add constraint emargement_lignes_signature check (
  (signe_le is null) = (signe_par is null)
  and case when signature_effacee_le is null then (trace is null) = (signe_le is null)
           else trace is null and signe_le is not null end);
alter table public.emargement_formateurs add column signature_effacee_le timestamptz;
alter table public.emargement_formateurs alter column trace drop not null;
alter table public.emargement_formateurs add constraint emargement_formateurs_signature
  check ((trace is null) = (signature_effacee_le is not null));

-- Journal : types des étapes de ce lot (questionnaires : tâche 3 ; registre : tâche 4).
alter table public.effacements_journal drop constraint effacements_journal_type_check;
alter table public.effacements_journal add constraint effacements_journal_type_check
  check (type in ('stagiaire', 'promo', 'benevoles', 'etape1', 'etape2', 'demande', 'questionnaires', 'registre'));

-- 2. Anciennes fonctions supprimées --------------------------------------------------------------------------------
drop function public.anonymiser_promo();
drop function public.anonymiser_promo(integer);
drop function public.anonymiser_stagiaire(integer);
drop function public.etat_anonymisation_promo();
drop function public.etat_anonymisation_promo(integer);
drop function public._anonymiser_stagiaire(integer);

-- 2 bis. Textes libres d'une fiche (interne) -----------------------------------------------------------------------
-- Commentaires d'EPCF, observations des notes, commentaires des passages, observations de l'émargement, et leurs copies
-- dans les historiques. Jouée par l'étape 1, puis de nouveau par l'étape 2 quand l'étape 1 est déjà faite : après l'étape
-- 1, la fiche garde son nom et reste listée, un formateur peut encore y écrire (relecture finale, constat 3). Idempotente :
-- { epcf_textes, observations, commentaires_passages, emargement_observations }, des zéros au second passage.
-- (epcf_evaluations.contexte n'est pas un texte libre : c'est un code, « EPCF ».)
create function public._effacer_textes_libres(p_id integer)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_n jsonb := '{}'::jsonb;
  n integer;
begin
  update epcf_evaluations set commentaire = null where stagiaire_id = p_id and commentaire is not null;
  get diagnostics n = row_count; v_n := v_n || jsonb_build_object('epcf_textes', n);
  update evaluations set observation = null where stagiaire_id = p_id and observation is not null;
  get diagnostics n = row_count; v_n := v_n || jsonb_build_object('observations', n);
  update passages set commentaire = null where stagiaire_id = p_id and commentaire is not null;
  get diagnostics n = row_count; v_n := v_n || jsonb_build_object('commentaires_passages', n);

  perform set_config('emargement.effacement', 'on', true);
  update emargement_lignes set observation = null where stagiaire_id = p_id and observation is not null;
  get diagnostics n = row_count;
  perform set_config('emargement.effacement', '', true);
  v_n := v_n || jsonb_build_object('emargement_observations', n);

  -- Les historiques gardent une copie des lignes : on y vide aussi les textes libres (là seulement où il en reste).
  update evaluations_audit
     set before_data = case when before_data ? 'observation' then jsonb_set(before_data, '{observation}', 'null') else before_data end,
         after_data  = case when after_data  ? 'observation' then jsonb_set(after_data,  '{observation}', 'null') else after_data end
   where ((before_data ->> 'stagiaire_id')::int = p_id or (after_data ->> 'stagiaire_id')::int = p_id)
     and (before_data ->> 'observation' is not null or after_data ->> 'observation' is not null);
  update passages_audit
     set before_data = case when before_data ? 'commentaire' then jsonb_set(before_data, '{commentaire}', 'null') else before_data end,
         after_data  = case when after_data  ? 'commentaire' then jsonb_set(after_data,  '{commentaire}', 'null') else after_data end
   where ((before_data ->> 'stagiaire_id')::int = p_id or (after_data ->> 'stagiaire_id')::int = p_id)
     and (before_data ->> 'commentaire' is not null or after_data ->> 'commentaire' is not null);
  return v_n;
end;
$function$;

-- 3. Étape 1 d'une fiche (interne) ---------------------------------------------------------------------------------
-- Ce que faisait _anonymiser_stagiaire, SAUF le dossier professionnel, le livret, le nom et actif ; EN PLUS : observations
-- de l'émargement de la fiche, e-mails de la personne sur l'émargement, participations de la fiche aux questionnaires
-- (la liste « qui a répondu » ; un compte supprimé ne les emporte plus, section 10). Rejouée : { deja: true }.
create function public._effacer_etape1(p_id integer)
returns jsonb language plpgsql security definer set search_path to 'public', 'auth', 'pg_temp' as $function$
declare
  s record;
  v_emails text[];
  v_retrouvees text[];    -- adresses laissées sur la fiche (compte déjà retiré), hors adresses de son compte
  v_vivantes text[];      -- parmi elles, celles qui servent encore à un compte : retirées des seules lignes de la fiche
  v_noms text[];          -- formes sous lesquelles la personne apparaît dans les champs « qui »
  v_remplace constant text := 'Stagiaire anonyme';
  v_n jsonb := '{}'::jsonb;
  n integer;
  x text;
begin
  select * into s from stagiaires where id = p_id for update;
  if not found then raise exception 'conservation: Fiche introuvable.'; end if;
  if s.efface_le is not null then return jsonb_build_object('deja', true); end if;

  if exists (select 1 from user_profiles u where u.stagiaire_id = p_id
                and (u.is_admin or u.is_founder or exists (select 1 from affectations a where lower(a.email) = lower(u.email)))) then
    raise exception 'conservation: Cette fiche est reliée à un compte d''équipe : elle n''est jamais effacée.';
  end if;

  select coalesce(array_agg(distinct lower(email)), '{}') into v_emails
    from user_profiles where stagiaire_id = p_id;
  -- Compte déjà retiré (relecture finale, constat 2) : ses adresses restent sur ce qu'elle a fait depuis sa fiche. Une ligne
  -- d'émargement de la fiche signée sur son propre appareil porte son adresse (signe_par) ; un signalement de question
  -- fait depuis sa fiche aussi (qcm_signalements.email). Ces adresses ne sont jamais celles d'un formateur.
  select coalesce(array_agg(distinct a.e), '{}') into v_retrouvees
    from (select lower(l.signe_par) as e from emargement_lignes l
           where l.stagiaire_id = p_id and not l.sur_appareil_formateur and l.signe_par is not null
          union
          select lower(q.email) from qcm_signalements q where q.stagiaire_id = p_id) a
   where a.e is not null and a.e <> 'anonyme' and not (a.e = any(v_emails));
  -- Une adresse retrouvée qui sert encore (profil d'une autre fiche : la personne inscrite ailleurs ; équipe) n'est
  -- effacée que des lignes de cette fiche ; les autres rejoignent les adresses de la personne (compte de connexion resté
  -- sans profil compris).
  select coalesce(array_agg(e), '{}') into v_vivantes
    from unnest(v_retrouvees) e
   where exists (select 1 from user_profiles u where lower(u.email) = e)
      or exists (select 1 from affectations a where lower(a.email) = e);
  v_emails := v_emails || array(select e from unnest(v_retrouvees) e where not (e = any(v_vivantes)));
  -- Nom affiché dans l'app (« V. Timy », cf. displayStagiaire) et e-mails (repli de getProfileWho).
  v_noms := array[case when coalesce(trim(s.nom), '') <> ''
                       then upper(left(trim(s.nom), 1)) || '. ' || s.prenom else s.prenom end]
            || v_emails;

  -- Données privées : supprimées (le dossier professionnel et le livret restent jusqu'à l'étape 2).
  delete from stagiaires_prive where stagiaire_id = p_id; get diagnostics n = row_count; v_n := v_n || jsonb_build_object('date_naissance', n);
  -- Fiche de suivi : la table peut avoir été retirée (branche navigation-unique) ; requête dynamique, clé gardée à 0.
  n := 0;
  if to_regclass('public.fiches_suivi') is not null then
    execute 'delete from public.fiches_suivi where stagiaire_id = $1' using p_id;
    get diagnostics n = row_count;
  end if;
  v_n := v_n || jsonb_build_object('fiche_suivi', n);

  -- Résultats conservés, textes libres vidés (ils peuvent contenir un prénom, une santé…), observations de l'émargement
  -- et copies des historiques comprises.
  v_n := v_n || _effacer_textes_libres(p_id);

  -- Une adresse retrouvée qui sert encore à un compte : retirée des seules lignes de cette fiche (émargement, évaluations,
  -- signalements faits depuis la fiche) ; ailleurs elle reste, la personne l'utilise toujours.
  if cardinality(v_vivantes) > 0 then
    perform set_config('emargement.effacement', 'on', true);
    update emargement_lignes set signe_par = 'anonyme' where stagiaire_id = p_id and lower(signe_par) = any(v_vivantes);
    perform set_config('emargement.effacement', '', true);
    perform set_config('emargement.effacement', 'on', true);
    update emargement_lignes set maj_par = 'anonyme' where stagiaire_id = p_id and lower(maj_par) = any(v_vivantes);
    perform set_config('emargement.effacement', '', true);
    update evaluations set created_by_email = 'anonyme' where stagiaire_id = p_id and lower(created_by_email) = any(v_vivantes);
    update evaluations set updated_by_email = 'anonyme' where stagiaire_id = p_id and lower(updated_by_email) = any(v_vivantes);
    update qcm_signalements set email = 'anonyme' where stagiaire_id = p_id and lower(email) = any(v_vivantes);
  end if;

  -- Émargement : e-mails de la personne (elle a signé ou été notée sous son adresse).
  if cardinality(v_emails) > 0 then
    perform set_config('emargement.effacement', 'on', true);
    update emargement_lignes set signe_par = 'anonyme' where lower(signe_par) = any(v_emails);
    perform set_config('emargement.effacement', '', true);
    perform set_config('emargement.effacement', 'on', true);
    update emargement_lignes set maj_par = 'anonyme' where lower(maj_par) = any(v_emails);
    perform set_config('emargement.effacement', '', true);
  end if;

  -- E-mails de la personne, partout où ils servent de signature.
  if cardinality(v_emails) > 0 then
    update evaluations set created_by_email = 'anonyme' where lower(created_by_email) = any(v_emails);
    update evaluations set updated_by_email = 'anonyme' where lower(updated_by_email) = any(v_emails);
    update evaluations_audit set changed_by_email = 'anonyme' where lower(changed_by_email) = any(v_emails);
    update agenda_events set created_by_email = 'anonyme' where lower(created_by_email) = any(v_emails);
    update qcm_signalements set email = 'anonyme' where lower(email) = any(v_emails);
    -- themes.updated_by_email peut avoir été retirée (branche navigation-unique) : requête dynamique.
    if exists (select 1 from pg_attribute where attrelid = to_regclass('public.themes')
                  and attname = 'updated_by_email' and attnum > 0 and not attisdropped) then
      execute 'update public.themes set updated_by_email = ''anonyme'' where lower(updated_by_email) = any($1)' using v_emails;
    end if;
    update themes_progression set updated_by_email = 'anonyme' where lower(updated_by_email) = any(v_emails);
    update user_profiles set invited_by_email = 'anonyme' where lower(invited_by_email) = any(v_emails);
    delete from conditions_acceptations where lower(email) = any(v_emails);
  end if;

  -- Champs « qui a fait la modification » (nom affiché ou e-mail).
  update passages set created_by_who = v_remplace where created_by_who = any(v_noms);
  update passages set updated_by_who = v_remplace where updated_by_who = any(v_noms);
  update passages_audit set changed_by_who = v_remplace where changed_by_who = any(v_noms);
  update epcf_evaluations set updated_by_who = v_remplace where updated_by_who = any(v_noms);
  update planning_jours_off set created_by_who = v_remplace where created_by_who = any(v_noms);

  -- Historiques : les mêmes valeurs dans les instantanés JSON (valeurs exactes entre guillemets).
  foreach x in array v_noms loop
    update passages_audit
       set before_data = replace(before_data::text, to_jsonb(x)::text, to_jsonb(v_remplace)::text)::jsonb,
           after_data  = replace(after_data::text,  to_jsonb(x)::text, to_jsonb(v_remplace)::text)::jsonb
     where before_data::text like '%' || to_jsonb(x)::text || '%'
        or after_data::text  like '%' || to_jsonb(x)::text || '%';
    update evaluations_audit
       set before_data = replace(before_data::text, to_jsonb(x)::text, to_jsonb('anonyme'::text)::text)::jsonb,
           after_data  = replace(after_data::text,  to_jsonb(x)::text, to_jsonb('anonyme'::text)::text)::jsonb
     where before_data::text like '%' || to_jsonb(x)::text || '%'
        or after_data::text  like '%' || to_jsonb(x)::text || '%';
  end loop;

  -- Participations de la fiche aux questionnaires (les réponses, anonymes, restent).
  delete from questionnaire_participations where stagiaire_id = p_id;

  -- Compte : profil puis compte de connexion (sessions et compteur de l'assistant en cascade).
  delete from user_profiles where stagiaire_id = p_id; get diagnostics n = row_count; v_n := v_n || jsonb_build_object('profils', n);
  if cardinality(v_emails) > 0 then
    delete from auth.users where lower(email) = any(v_emails); get diagnostics n = row_count;
    v_n := v_n || jsonb_build_object('comptes', n);
  end if;

  -- Ni le nom ni actif : la marque seule (date_naissance, déjà vide sur la fiche, est gardée vide).
  perform set_config('conservation.effacement', 'on', true);
  update stagiaires set date_naissance = null, efface_le = now() where id = p_id;
  perform set_config('conservation.effacement', '', true);

  return v_n;
end;
$function$;

-- 4. Étape 2 d'une fiche (interne) ---------------------------------------------------------------------------------
-- L'étape 1 si elle manque (fondateur en retard : pas de refus), sinon ses textes libres de nouveau (écrits depuis l'étape
-- 1 sur la fiche encore nommée) ; puis dossier professionnel, livret, tracés des signatures de la fiche (heure gardée,
-- signataire « anonyme »), nom. Rejouée : { deja: true }.
create function public._effacer_etape2(p_id integer)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  s record;
  v_n jsonb := '{}'::jsonb;
  n integer;
begin
  select * into s from stagiaires where id = p_id for update;
  if not found then raise exception 'conservation: Fiche introuvable.'; end if;
  if s.anonymise_le is not null then return jsonb_build_object('deja', true); end if;

  if exists (select 1 from user_profiles u where u.stagiaire_id = p_id
                and (u.is_admin or u.is_founder or exists (select 1 from affectations a where lower(a.email) = lower(u.email)))) then
    raise exception 'conservation: Cette fiche est reliée à un compte d''équipe : elle n''est jamais effacée.';
  end if;

  if s.efface_le is null then
    v_n := _effacer_etape1(p_id);
  else
    v_n := _effacer_textes_libres(p_id);
  end if;

  delete from dp_dossiers where stagiaire_id = p_id;  get diagnostics n = row_count; v_n := v_n || jsonb_build_object('dossier_pro', n);
  delete from epcf_livrets where stagiaire_id = p_id; get diagnostics n = row_count; v_n := v_n || jsonb_build_object('livret', n);

  perform set_config('emargement.effacement', 'on', true);
  update emargement_lignes set trace = null, signe_par = 'anonyme', signature_effacee_le = now()
   where stagiaire_id = p_id and trace is not null;
  get diagnostics n = row_count;
  perform set_config('emargement.effacement', '', true);
  v_n := v_n || jsonb_build_object('signatures', n);

  perform set_config('conservation.effacement', 'on', true);
  update stagiaires set prenom = 'Anonyme ' || p_id, nom = null, anonymise_le = now() where id = p_id;
  perform set_config('conservation.effacement', '', true);

  return v_n;
end;
$function$;

revoke all on function public._effacer_textes_libres(integer), public._effacer_etape1(integer), public._effacer_etape2(integer)
  from public, anon, authenticated, service_role;

-- 5. État de la conservation (page Qualiopi) -----------------------------------------------------------------------
-- { jour, promos: [{ id, nom, lieu_nom, date_fin, etape1_du, etape2_du, a_effacer_etape1, a_effacer_etape2,
-- comptes_equipe, emargement_etape2 }], portees_formateurs: [{ lieu_id, lieu_nom, annee, a_participations,
-- participations, cloture_du, close, a_commentaires, commentaires, commentaires_du, a_reponses, reponses, sous_seuil,
-- fige, figeage_du }], registre: { a_effacer, a_clore, efface, prochaine_echeance } }. Les promos et les
-- lieux accessibles seulement (un lieu l'est par une de ses promos) ; les nombres « à effacer » ne comptent jamais les
-- comptes d'équipe. emargement_etape2 : les signatures de formateurs et les tracés de fiches déjà sans nom qui restent
-- à effacer à l'étape 2. portees_formateurs : chaque lieu et année du questionnaire des formateurs qui garde des
-- réponses, des participations ou des résultats figés. Rien sous le seuil (lot Q3, 3 pour les formateurs) :
-- a_participations, a_commentaires, a_reponses disent s'il reste quelque chose ; participations, commentaires et
-- reponses ne sont des nombres que si la portée a au moins le seuil de répondants (sinon nuls, et sous_seuil vrai) ;
-- close : l'année est close ; fige : les résultats sont figés. registre (lot Q4, section 11) : a_effacer = entrées closes
-- depuis plus de 3 ans dont les textes sont encore là ; a_clore = entrées jamais closes (jamais effacées sans clôture) ;
-- efface = entrées déjà vidées ; prochaine_echeance = jour (de Paris) où la prochaine entrée close arrive à l'échéance, nul
-- s'il n'y en a pas. Des nombres seulement : aucun texte du registre.
create function public.etat_conservation()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $function$
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
$function$;

-- 6. Étape 1 d'une promo -------------------------------------------------------------------------------------------
create function public.effacer_promo_etape1(p_promo integer)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  p record;
  s record;
  v_du date;
  v jsonb;
  v_somme jsonb := '{}'::jsonb;
  v_faits integer := 0;
  v_equipe integer := 0;
  v_com integer := 0;
  v_com_fait boolean := false;
  v_com_sous_seuil boolean := false;
  r integer;
  n integer;
  k text;
  x jsonb;
begin
  if not peut_gerer_qualite() then
    raise exception 'conservation: Réservé à la gestion de la qualité.';
  end if;
  if p_promo is null or not peut_acceder_promo(p_promo) then
    raise exception 'conservation: Cette promo n''est pas dans votre périmètre.';
  end if;
  -- Deux appels simultanés sur la même promo passent l'un après l'autre.
  select * into p from promos where id = p_promo for no key update;
  if p.date_fin is null then
    raise exception 'conservation: Renseigne d''abord la date de fin de cette promo.';
  end if;
  v_du := (p.date_fin + interval '12 months')::date;
  if _questionnaire_jour() < v_du then
    raise exception 'conservation: Possible à partir du %.', to_char(v_du, 'DD/MM/YYYY');
  end if;
  for s in select id from stagiaires where promo_id = p.id and efface_le is null order by id loop
    if exists (select 1 from user_profiles u where u.stagiaire_id = s.id
                  and (u.is_admin or u.is_founder or exists (select 1 from affectations a where lower(a.email) = lower(u.email)))) then
      v_equipe := v_equipe + 1;
      continue;
    end if;
    v := _effacer_etape1(s.id);
    if coalesce((v ->> 'deja')::boolean, false) then continue; end if;
    v_faits := v_faits + 1;
    for k, x in select e.key, e.value from jsonb_each(v) e loop
      v_somme := v_somme || jsonb_build_object(k, coalesce((v_somme ->> k)::integer, 0) + x::text::integer);
    end loop;
  end loop;
  -- Commentaires libres des deux questionnaires de la promo (les notes restent ; réponses rebrassées). Rien sous le
  -- seuil (lot Q3) : questionnaires_commentaires_effaces dit si des commentaires sont partis ; leur nombre
  -- (commentaires_questionnaires) n'est donné que si chaque questionnaire concerné a au moins le seuil de réponses.
  foreach k in array array['fin_stagiaire', 'six_mois_stagiaire'] loop
    select count(*) into r from questionnaire_reponses where cle = k and promo_id = p.id;
    n := _questionnaire_effacer_commentaires(k, p.id, null, null);
    if n > 0 then
      v_com_fait := true;
      if r >= _questionnaire_seuil(k) then v_com := v_com + n; else v_com_sous_seuil := true; end if;
    end if;
  end loop;
  v := jsonb_build_object('fiches', v_faits, 'comptes_equipe', v_equipe) || v_somme
       || jsonb_build_object('questionnaires_commentaires_effaces', v_com_fait)
       || case when v_com_fait and not v_com_sous_seuil
               then jsonb_build_object('commentaires_questionnaires', v_com) else '{}'::jsonb end;
  if v_faits > 0 or v_com_fait then
    insert into effacements_journal (type, cible, fait_par_email, details)
    values ('etape1', 'promo ' || p.id, lower(auth.jwt() ->> 'email'), v);
  end if;
  return v;
end;
$function$;

-- 7. Étape 2 d'une promo -------------------------------------------------------------------------------------------
create function public.effacer_promo_etape2(p_promo integer)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  p record;
  s record;
  v_du date;
  v jsonb;
  v_somme jsonb := '{}'::jsonb;
  v_faits integer := 0;
  v_equipe integer := 0;
  v_formateurs integer;
  v_traces integer;
  v_emails integer := 0;
  v_figes integer := 0;
  n integer;
  k text;
  x jsonb;
begin
  if not peut_gerer_qualite() then
    raise exception 'conservation: Réservé à la gestion de la qualité.';
  end if;
  if p_promo is null or not peut_acceder_promo(p_promo) then
    raise exception 'conservation: Cette promo n''est pas dans votre périmètre.';
  end if;
  select * into p from promos where id = p_promo for no key update;
  if p.date_fin is null then
    raise exception 'conservation: Renseigne d''abord la date de fin de cette promo.';
  end if;
  v_du := make_date(extract(year from p.date_fin)::integer + 4, 1, 1);
  if _questionnaire_jour() < v_du then
    raise exception 'conservation: Possible à partir du %.', to_char(v_du, 'DD/MM/YYYY');
  end if;

  -- Fiches : étape 2 (l'étape 1 d'abord quand elle manque).
  for s in select id from stagiaires where promo_id = p.id and anonymise_le is null order by id loop
    if exists (select 1 from user_profiles u where u.stagiaire_id = s.id
                  and (u.is_admin or u.is_founder or exists (select 1 from affectations a where lower(a.email) = lower(u.email)))) then
      v_equipe := v_equipe + 1;
      continue;
    end if;
    v := _effacer_etape2(s.id);
    if coalesce((v ->> 'deja')::boolean, false) then continue; end if;
    v_faits := v_faits + 1;
    for k, x in select e.key, e.value from jsonb_each(v) e loop
      v_somme := v_somme || jsonb_build_object(k, coalesce((v_somme ->> k)::integer, 0) + x::text::integer);
    end loop;
  end loop;

  -- Feuilles de la promo. Formateurs : un nom provisoire d'abord (l'index unique sur le nom par feuille interdirait
  -- deux « Formateur 1 » le temps de l'écriture), puis « Formateur n » dans l'ordre des signatures.
  perform set_config('emargement.effacement', 'on', true);
  update emargement_formateurs set nom = '#' || id
   where promo_id = p.id and signature_effacee_le is null;
  get diagnostics v_formateurs = row_count;
  perform set_config('emargement.effacement', '', true);
  perform set_config('emargement.effacement', 'on', true);
  update emargement_formateurs f
     set nom = 'Formateur ' || r.rang, prof_id = null, trace = null, signe_par = 'anonyme', signature_effacee_le = now()
    from (select id, row_number() over (partition by seance_id order by signe_le, id) as rang
            from emargement_formateurs where promo_id = p.id) r
   where f.id = r.id and f.signature_effacee_le is null;
  perform set_config('emargement.effacement', '', true);
  -- Tracés des fiches déjà sans nom (anonymisées avant ce lot, ou dont les lignes sont sur une feuille de cette promo).
  perform set_config('emargement.effacement', 'on', true);
  update emargement_lignes l set trace = null, signe_par = 'anonyme', signature_effacee_le = now()
    from stagiaires sa
   where sa.id = l.stagiaire_id and l.promo_id = p.id and l.trace is not null and sa.anonymise_le is not null;
  get diagnostics v_traces = row_count;
  perform set_config('emargement.effacement', '', true);
  -- E-mails des feuilles (formateurs qui ont ouvert, clos, signé sur leur appareil ou mis à jour).
  perform set_config('emargement.effacement', 'on', true);
  update emargement_lignes set signe_par = 'anonyme' where promo_id = p.id and signe_par <> 'anonyme';
  get diagnostics n = row_count; v_emails := v_emails + n;
  perform set_config('emargement.effacement', '', true);
  perform set_config('emargement.effacement', 'on', true);
  update emargement_lignes set maj_par = 'anonyme' where promo_id = p.id and maj_par <> 'anonyme';
  get diagnostics n = row_count; v_emails := v_emails + n;
  perform set_config('emargement.effacement', '', true);
  perform set_config('emargement.effacement', 'on', true);
  update emargement_seances set ouverte_par = 'anonyme' where promo_id = p.id and ouverte_par <> 'anonyme';
  get diagnostics n = row_count; v_emails := v_emails + n;
  perform set_config('emargement.effacement', '', true);
  perform set_config('emargement.effacement', 'on', true);
  update emargement_seances set close_par = 'anonyme' where promo_id = p.id and close_par <> 'anonyme';
  get diagnostics n = row_count; v_emails := v_emails + n;
  perform set_config('emargement.effacement', '', true);

  -- Questionnaires de la promo : comptes figés (à partir du seuil), puis réponses et participations supprimées.
  foreach k in array array['fin_stagiaire', 'six_mois_stagiaire'] loop
    if coalesce((_questionnaire_figer(k, p.id, null, null) ->> 'fige')::boolean, false) then
      v_figes := v_figes + 1;
    end if;
  end loop;

  v := jsonb_build_object('fiches', v_faits, 'comptes_equipe', v_equipe) || v_somme
       || jsonb_build_object('signatures', coalesce((v_somme ->> 'signatures')::integer, 0) + v_traces,
                             'signatures_formateurs', v_formateurs, 'emargement_emails', v_emails,
                             'questionnaires_figes', v_figes);
  if v_faits + v_formateurs + v_traces + v_emails + v_figes > 0 then
    insert into effacements_journal (type, cible, fait_par_email, details)
    values ('etape2', 'promo ' || p.id, lower(auth.jwt() ->> 'email'), v);
  end if;
  return v;
end;
$function$;

-- 8. Effacement sur demande de la personne -------------------------------------------------------------------------
-- Les deux étapes tout de suite, sans condition de date ni d'abandon (actif n'est pas touché).
create function public.effacer_sur_demande(p_stagiaire_id integer)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_promo integer;
  v jsonb;
begin
  if not peut_gerer_qualite() then
    raise exception 'conservation: Réservé à la gestion de la qualité.';
  end if;
  select promo_id into v_promo from stagiaires where id = p_stagiaire_id;
  if not found then
    raise exception 'conservation: Fiche introuvable.';
  end if;
  if not peut_acceder_promo(v_promo) then
    raise exception 'conservation: Cette fiche n''est pas dans votre périmètre.';
  end if;
  v := _effacer_etape2(p_stagiaire_id);
  if not coalesce((v ->> 'deja')::boolean, false) then
    insert into effacements_journal (type, cible, fait_par_email, details)
    values ('demande', 'stagiaire ' || p_stagiaire_id, lower(auth.jwt() ->> 'email'), v);
  end if;
  return v;
end;
$function$;

revoke all on function public.etat_conservation(), public.effacer_promo_etape1(integer),
  public.effacer_promo_etape2(integer), public.effacer_sur_demande(integer) from public, anon, authenticated, service_role;
grant execute on function public.etat_conservation(), public.effacer_promo_etape1(integer),
  public.effacer_promo_etape2(integer), public.effacer_sur_demande(integer) to authenticated, service_role;

-- 8 bis. Fiches effacées à la demande, lisibles par toute l'équipe d'une promo (tableau de bord, dossiers) --------------
-- La règle de lecture du journal suit la seule promo affichée : une lecture directe laisserait vides les lignes des autres
-- promos pour un formateur. Cette fonction rend les seuls identifiants de fiche (type « demande ») des promos dont
-- l'appelant est l'équipe, jamais le texte du journal. Même condition d'équipe que la règle du journal du lot 4
-- (fondateur, formateur de la promo, direction de son lieu), mais promo par promo et non sur la seule promo affichée :
-- un stagiaire de la promo (peut_acceder_promo) reçoit une liste vide, sans erreur.
create function public.fiches_effacees_sur_demande(p_promo_ids integer[])
returns setof integer language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select s.id
    from stagiaires s
   where s.promo_id = any (coalesce(p_promo_ids, '{}'::integer[]))
     and (est_fondateur() or est_formateur(s.promo_id) or est_direction(lieu_de_promo(s.promo_id)))
     and exists (select 1 from effacements_journal j where j.type = 'demande' and j.cible = 'stagiaire ' || s.id)
   order by s.id;
$function$;

revoke all on function public.fiches_effacees_sur_demande(integer[]) from public, anon, authenticated, service_role;
grant execute on function public.fiches_effacees_sur_demande(integer[]) to authenticated, service_role;

-- 9. Émargement : une fiche sans nom ne signe plus, n'est plus annotée, ne reçoit plus d'absence ------------------
-- create or replace : droits d'exécution du 23/10 gardés. emargement_signer : version du lot 4 (formateur_courant),
-- emargement_annoter et emargement_clore : versions du 23/10 ; seule la condition sur la fiche change.
CREATE OR REPLACE FUNCTION public.emargement_signer(p_seance bigint, p_stagiaire integer, p_trace text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  s emargement_seances := emargement_feuille(p_seance, false);
  v_appareil boolean;
  v_quand timestamptz;
begin
  if s.statut <> 'ouverte' then
    raise exception 'emargement: La feuille est close.';
  end if;
  if s.jour <> emargement_jour_paris() then
    raise exception 'emargement: Une feuille ne se signe que le jour même.';
  end if;
  if p_stagiaire is not null and p_stagiaire = my_stagiaire_id() then
    v_appareil := false;
  elsif formateur_courant() then
    v_appareil := true;
  else
    raise exception 'emargement: Tu ne peux signer que pour toi.';
  end if;
  if not exists (select 1 from stagiaires where id = p_stagiaire and promo_id = s.promo_id and actif
                    and anonymise_le is null) then
    raise exception 'emargement: Stagiaire introuvable dans cette promo.';
  end if;
  if not emargement_trace_valide(p_trace) then
    raise exception 'emargement: Signature illisible, recommence.';
  end if;
  if exists (select 1 from emargement_lignes where seance_id = s.id and stagiaire_id = p_stagiaire and absent) then
    raise exception 'emargement: Noté absent : un formateur doit d''abord retirer l''absence.';
  end if;
  insert into emargement_lignes (seance_id, promo_id, stagiaire_id, trace, signe_le, signe_par,
                                 sur_appareil_formateur, maj_par)
  values (s.id, s.promo_id, p_stagiaire, p_trace, now(), v_email, v_appareil, v_email)
  on conflict (seance_id, stagiaire_id) do update
    set trace = excluded.trace, signe_le = excluded.signe_le, signe_par = excluded.signe_par,
        sur_appareil_formateur = excluded.sur_appareil_formateur, maj_le = now(), maj_par = excluded.maj_par
    where emargement_lignes.trace is null and not emargement_lignes.absent
  returning signe_le into v_quand;
  if v_quand is null then
    raise exception 'emargement: Déjà signé.';
  end if;
  return v_quand;
end;
$function$;

CREATE OR REPLACE FUNCTION public.emargement_annoter(p_seance bigint, p_stagiaire integer, p_absent boolean, p_observation text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  s emargement_seances := emargement_feuille(p_seance, true);
  l emargement_lignes;
  v_obs text := nullif(btrim(p_observation), '');
begin
  if not exists (select 1 from stagiaires where id = p_stagiaire and promo_id = s.promo_id and anonymise_le is null) then
    raise exception 'emargement: Stagiaire introuvable dans cette promo.';
  end if;
  if length(v_obs) > 200 then
    raise exception 'emargement: Observation trop longue (200 caractères au plus).';
  end if;
  select * into l from emargement_lignes where seance_id = s.id and stagiaire_id = p_stagiaire for update;
  if p_absent is not null then
    if s.statut <> 'ouverte' then
      raise exception 'emargement: La feuille est close : rouvre-la pour changer une absence.';
    end if;
    if p_absent and l.trace is not null then
      raise exception 'emargement: Déjà signé : ajoute plutôt une observation.';
    end if;
  end if;
  if l.id is null then
    if p_absent is not true and v_obs is null then
      return;  -- rien à noter
    end if;
    insert into emargement_lignes (seance_id, promo_id, stagiaire_id, absent, absence_origine, observation, maj_par)
    values (s.id, s.promo_id, p_stagiaire, coalesce(p_absent, false),
            case when p_absent then 'formateur' end, v_obs, v_email);
    return;
  end if;
  update emargement_lignes
     set absent = coalesce(p_absent, absent),
         absence_origine = case when p_absent is null then absence_origine
                                when p_absent then 'formateur' end,
         observation = case when p_observation is null then observation else v_obs end,
         maj_le = now(), maj_par = v_email
   where id = l.id;
  delete from emargement_lignes
   where id = l.id and trace is null and not absent and observation is null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.emargement_clore(p_seance bigint)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  s emargement_seances := emargement_feuille(p_seance, true);
  v_jour_index integer;
  v_n integer;
begin
  if s.statut <> 'ouverte' then
    raise exception 'emargement: Cette feuille est déjà close.';
  end if;
  if not exists (select 1 from emargement_formateurs where seance_id = s.id) then
    raise exception 'emargement: Il manque la signature du formateur.';
  end if;
  v_jour_index := extract(isodow from s.jour)::integer - 1;
  with planning as (
    select distinct case when (a ->> 'sid') ~ '^[0-9]{1,9}$' then (a ->> 'sid')::integer end as sid
      from planning_entries pe
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(pe.absences) = 'array' then pe.absences else '[]'::jsonb end) a
     where pe.promo_id = s.promo_id
       and pe.semaine_lundi = s.jour - v_jour_index
       and pe.day_index = v_jour_index
       and pe.half_day = s.demi_journee
  ), absents as (
    insert into emargement_lignes (seance_id, promo_id, stagiaire_id, absent, absence_origine, maj_par)
    select s.id, s.promo_id, st.id, true,
           case when st.id in (select sid from planning where sid is not null) then 'planning' else 'non_signe' end,
           v_email
      from stagiaires st
     where st.promo_id = s.promo_id and st.actif and st.anonymise_le is null
    on conflict (seance_id, stagiaire_id) do update
      set absent = true, absence_origine = excluded.absence_origine, maj_le = now(), maj_par = excluded.maj_par
      where emargement_lignes.trace is null and not emargement_lignes.absent
    returning 1
  )
  select count(*) into v_n from absents;
  update emargement_seances set statut = 'close', close_le = now(), close_par = v_email where id = s.id;
  return v_n;
end;
$function$;

-- 10. Questionnaires ------------------------------------------------------------------------------------------------
-- 10.1 Participations rattachées à la fiche. Remplie depuis user_profiles (compte, e-mail, fiche) ; une participation de
-- stagiaire qui ne retrouve pas sa fiche arrête la migration (aucune le 10/11) ; deux comptes de la même fiche : une
-- seule ligne gardée (aucun doublon le 10/11). Un compte supprimé laisse la ligne (user_id nul) : l'unicité par compte
-- ne porte plus que sur les lignes qui en ont un.
alter table public.questionnaire_participations
  add column stagiaire_id integer references public.stagiaires(id) on delete cascade;
update public.questionnaire_participations p set stagiaire_id = up.stagiaire_id
  from auth.users u join public.user_profiles up on lower(up.email) = lower(u.email)
 where u.id = p.user_id and p.cle <> 'fin_formateur' and up.stagiaire_id is not null;
do $garde$
begin
  if exists (select 1 from public.questionnaire_participations where cle <> 'fin_formateur' and stagiaire_id is null) then
    raise exception 'conservation: Une participation de stagiaire ne retrouve pas sa fiche : à trancher avant la migration.';
  end if;
end
$garde$;
delete from public.questionnaire_participations p
 using (select ctid, row_number() over (partition by cle, promo_id, stagiaire_id order by user_id) as rang
          from public.questionnaire_participations where stagiaire_id is not null) d
 where p.ctid = d.ctid and d.rang > 1;
alter table public.questionnaire_participations
  drop constraint questionnaire_participations_unique,
  drop constraint questionnaire_participations_user_id_fkey,
  alter column user_id drop not null,
  add constraint questionnaire_participations_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete set null,
  add constraint questionnaire_participations_fiche
    check (case when cle = 'fin_formateur' then stagiaire_id is null else stagiaire_id is not null end),
  add constraint questionnaire_participations_fiche_unique unique (cle, promo_id, stagiaire_id);
create unique index questionnaire_participations_compte_unique on public.questionnaire_participations
  (cle, promo_id, lieu_id, annee, user_id) nulls not distinct where user_id is not null;

-- 10.2 Résultats figés (seule copie des pourcentages après le figeage) et années closes des formateurs -------------
-- reponses : le nombre de réponses, nul sous le seuil (alors questions est vide : la marque « figé » seule).
create table public.questionnaire_resultats_figes (
  cle text not null check (cle in ('fin_stagiaire', 'six_mois_stagiaire', 'fin_formateur')),
  promo_id integer references public.promos(id) on delete restrict,
  lieu_id integer references public.lieux(id) on delete restrict,
  annee integer check (annee between 2000 and 2100),
  seuil integer not null check (seuil >= 1),
  reponses integer check (reponses is null or reponses >= seuil),
  questions jsonb not null check (jsonb_typeof(questions) = 'object'),
  fige_le date not null,
  constraint questionnaire_resultats_figes_portee check (case when cle = 'fin_formateur'
    then promo_id is null and lieu_id is not null and annee is not null
    else promo_id is not null and lieu_id is null and annee is null end),
  constraint questionnaire_resultats_figes_sous_seuil check (reponses is not null or questions = '{}'::jsonb),
  constraint questionnaire_resultats_figes_unique unique nulls not distinct (cle, promo_id, lieu_id, annee)
);
create table public.questionnaire_clotures (
  lieu_id integer not null references public.lieux(id) on delete cascade,
  annee integer not null check (annee between 2000 and 2100),
  close_le timestamptz not null default now(),
  primary key (lieu_id, annee)
);
alter table public.questionnaire_resultats_figes enable row level security;
alter table public.questionnaire_clotures enable row level security;
revoke all on public.questionnaire_resultats_figes, public.questionnaire_clotures
  from public, anon, authenticated, service_role;

-- 10.3 Outils internes ----------------------------------------------------------------------------------------------
-- Brassage de repondre_questionnaire (20261108_questionnaires.sql, section 9), extrait tel quel : toutes les réponses
-- de la portée réécrites, dans un ordre tiré au hasard et avec un nouvel identifiant ; commentaire et réponses recopiés
-- pour que leurs morceaux TOAST soient réécrits aussi. À n'appeler que sous le verrou de la portée (celui de
-- repondre_questionnaire), comme le font ses trois appelants.
create function public._questionnaire_rebrasser(p_cle text, p_promo integer, p_lieu integer, p_annee integer)
returns void language plpgsql set search_path to 'public', 'pg_temp' as $function$
declare
  v_id uuid;
begin
  for v_id in
    select r.id from questionnaire_reponses r
     where r.cle = p_cle and r.promo_id is not distinct from p_promo
       and r.lieu_id is not distinct from p_lieu and r.annee is not distinct from p_annee
     order by random()
  loop
    update questionnaire_reponses
       set id = gen_random_uuid(), commentaire = commentaire || '', reponses = reponses || '{}'::jsonb
     where id = v_id;
  end loop;
end;
$function$;

-- Comptes de resultats_questionnaire (section 10 de la migration Q3), extraits tels quels : { reponses: n ou nul sous
-- le seuil, questions: { question: { valeur: nombre } } }, une question n'apparaissant qu'à partir du seuil.
create function public._questionnaire_comptes(p_cle text, p_promo integer, p_lieu integer, p_annee integer)
returns jsonb language plpgsql stable set search_path to 'public', 'pg_temp' as $function$
declare
  v_seuil integer := _questionnaire_seuil(p_cle);
  n integer;
  v_questions jsonb;
begin
  select count(*) into n from questionnaire_reponses r
   where r.cle = p_cle and r.promo_id is not distinct from p_promo
     and r.lieu_id is not distinct from p_lieu and r.annee is not distinct from p_annee;

  with paires as (
    select e.key as question,
           case jsonb_typeof(e.value) when 'null' then 'sans_avis'
                                       when 'string' then e.value #>> '{}'
                                       else e.value::text end as valeur
      from questionnaire_reponses r, jsonb_each(r.reponses) e
     where r.cle = p_cle and r.promo_id is not distinct from p_promo
       and r.lieu_id is not distinct from p_lieu and r.annee is not distinct from p_annee
  ),
  publiables as (
    select question from paires group by question having count(*) >= v_seuil
  ),
  comptes as (
    select question, jsonb_object_agg(valeur, nombre) as repartition
      from (select question, valeur, count(*) as nombre from paires
             where question in (select question from publiables) group by question, valeur) c
     group by question
  )
  select coalesce(jsonb_object_agg(question, repartition), '{}'::jsonb) into v_questions from comptes;

  return jsonb_build_object(
    'reponses', case when n >= v_seuil then n end,
    'questions', case when n >= v_seuil then v_questions else '{}'::jsonb end);
end;
$function$;

-- Questionnaire clos pour de bon (ouverture manuelle comprise) : résultats figés ; stagiaires, à partir de la date de
-- l'étape 1 de la promo ; formateurs, année close.
create function public._questionnaire_clos(p_cle text, p_promo integer, p_lieu integer, p_annee integer)
returns boolean language sql stable set search_path to 'public', 'pg_temp' as $function$
  select exists (select 1 from questionnaire_resultats_figes f
                  where f.cle = p_cle and f.promo_id is not distinct from p_promo
                    and f.lieu_id is not distinct from p_lieu and f.annee is not distinct from p_annee)
      or (p_cle in ('fin_stagiaire', 'six_mois_stagiaire') and exists (
            select 1 from promos pr
             where pr.id = p_promo and pr.date_fin is not null
               and _questionnaire_jour() >= (pr.date_fin + interval '12 months')::date))
      or (p_cle = 'fin_formateur' and exists (
            select 1 from questionnaire_clotures c where c.lieu_id = p_lieu and c.annee = p_annee));
$function$;

-- Commentaires libres d'une portée effacés (mis à nul), puis réponses rebrassées ; nombre de commentaires effacés.
create function public._questionnaire_effacer_commentaires(p_cle text, p_promo integer, p_lieu integer, p_annee integer)
returns integer language plpgsql set search_path to 'public', 'pg_temp' as $function$
declare
  n integer;
begin
  perform pg_advisory_xact_lock(hashtext('questionnaire:' || p_cle || ':'
    || coalesce(p_promo::text, p_lieu::text || '/' || p_annee::text)));
  update questionnaire_reponses r set commentaire = null
   where r.cle = p_cle and r.promo_id is not distinct from p_promo
     and r.lieu_id is not distinct from p_lieu and r.annee is not distinct from p_annee
     and r.commentaire is not null;
  get diagnostics n = row_count;
  if n > 0 then
    perform _questionnaire_rebrasser(p_cle, p_promo, p_lieu, p_annee);
  end if;
  return n;
end;
$function$;

-- Année des formateurs close (la liste « qui a répondu » effacée) ; nombre de participations effacées.
create function public._questionnaire_clore(p_lieu integer, p_annee integer)
returns integer language plpgsql set search_path to 'public', 'pg_temp' as $function$
declare
  n integer;
begin
  perform pg_advisory_xact_lock(hashtext('questionnaire:' || 'fin_formateur' || ':' || p_lieu::text || '/' || p_annee::text));
  insert into questionnaire_clotures (lieu_id, annee) values (p_lieu, p_annee) on conflict do nothing;
  delete from questionnaire_participations p
   where p.cle = 'fin_formateur' and p.lieu_id = p_lieu and p.annee = p_annee;
  get diagnostics n = row_count;
  return n;
end;
$function$;

-- Figeage d'une portée : comptes (au seuil seulement) dans la table figée, puis réponses et participations supprimées.
-- { deja: true } si déjà figée ; { vide: true } sans réponse ; sinon { fige: true, sous_seuil, reponses } (reponses nul
-- sous le seuil, comme dans resultats_questionnaire).
create function public._questionnaire_figer(p_cle text, p_promo integer, p_lieu integer, p_annee integer)
returns jsonb language plpgsql set search_path to 'public', 'pg_temp' as $function$
declare
  n integer;
  c jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('questionnaire:' || p_cle || ':'
    || coalesce(p_promo::text, p_lieu::text || '/' || p_annee::text)));
  if exists (select 1 from questionnaire_resultats_figes f
              where f.cle = p_cle and f.promo_id is not distinct from p_promo
                and f.lieu_id is not distinct from p_lieu and f.annee is not distinct from p_annee) then
    return jsonb_build_object('deja', true);
  end if;
  select count(*) into n from questionnaire_reponses r
   where r.cle = p_cle and r.promo_id is not distinct from p_promo
     and r.lieu_id is not distinct from p_lieu and r.annee is not distinct from p_annee;
  if n = 0 then
    delete from questionnaire_participations p
     where p.cle = p_cle and p.promo_id is not distinct from p_promo
       and p.lieu_id is not distinct from p_lieu and p.annee is not distinct from p_annee;
    return jsonb_build_object('vide', true);
  end if;
  c := _questionnaire_comptes(p_cle, p_promo, p_lieu, p_annee);
  insert into questionnaire_resultats_figes (cle, promo_id, lieu_id, annee, seuil, reponses, questions, fige_le)
  values (p_cle, p_promo, p_lieu, p_annee, _questionnaire_seuil(p_cle), (c ->> 'reponses')::integer, c -> 'questions',
          _questionnaire_jour());
  delete from questionnaire_reponses r
   where r.cle = p_cle and r.promo_id is not distinct from p_promo
     and r.lieu_id is not distinct from p_lieu and r.annee is not distinct from p_annee;
  delete from questionnaire_participations p
   where p.cle = p_cle and p.promo_id is not distinct from p_promo
     and p.lieu_id is not distinct from p_lieu and p.annee is not distinct from p_annee;
  return jsonb_build_object('fige', true, 'sous_seuil', c -> 'reponses' = 'null'::jsonb, 'reponses', c -> 'reponses');
end;
$function$;

revoke all on function public._questionnaire_rebrasser(text, integer, integer, integer),
  public._questionnaire_comptes(text, integer, integer, integer), public._questionnaire_clos(text, integer, integer, integer),
  public._questionnaire_effacer_commentaires(text, integer, integer, integer), public._questionnaire_clore(integer, integer),
  public._questionnaire_figer(text, integer, integer, integer)
  from public, anon, authenticated, service_role;

-- 10.4 Fonctions du lot Q3 réécrites (create or replace : droits d'exécution gardés) ----------------------------------
-- _questionnaire_ouvert : comme avant, sauf un questionnaire clos pour de bon (_questionnaire_clos), qui reste fermé
-- même ouvert à la main ; une année close sort ainsi aussi de questionnaires_a_remplir.
create or replace function public._questionnaire_ouvert(p_cle text, p_promo integer, p_lieu integer, p_annee integer)
returns boolean language sql stable set search_path to 'public', 'pg_temp' as $function$
  select not _questionnaire_clos(p_cle, p_promo, p_lieu, p_annee) and coalesce(
    (select o.ouvert from questionnaire_ouvertures o
      where o.cle = p_cle and o.promo_id is not distinct from p_promo
        and o.lieu_id is not distinct from p_lieu and o.annee is not distinct from p_annee),
    case when p_cle in ('fin_stagiaire', 'six_mois_stagiaire') then exists (
           select 1 from promos pr, _questionnaire_fenetre(p_cle, pr.date_fin) f
            where pr.id = p_promo and d.jour between f.du and f.au)
         when p_cle = 'fin_formateur' then p_annee = extract(year from d.jour)::integer and exists (
           select 1 from promos pr, _questionnaire_fenetre(p_cle, pr.date_fin) f
            where pr.lieu_id = p_lieu and d.jour between f.du and f.au)
         else false end)
  from (select _questionnaire_jour() as jour) d;
$function$;

-- questionnaires_a_remplir : comme avant, sauf qu'une participation de la fiche (compte recréé) suffit à ne plus rien
-- proposer.
create or replace function public.questionnaires_a_remplir()
returns table (cle text, version integer, portee jsonb)
language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  with moi as (
    select up.stagiaire_id from user_profiles up
     where lower(up.email) = lower((select auth.jwt() ->> 'email'))
     limit 1
  ),
  candidats as (
    select k.cle, s.promo_id, null::integer as lieu_id, null::integer as annee
      from moi join stagiaires s on s.id = moi.stagiaire_id
     cross join (values ('fin_stagiaire'), ('six_mois_stagiaire')) k(cle)
    union
    select 'fin_formateur', null, l.id, extract(year from _questionnaire_jour())::integer from lieux l
    union
    select o.cle, null, o.lieu_id, o.annee from questionnaire_ouvertures o where o.cle = 'fin_formateur' and o.ouvert
  )
  select c.cle, _questionnaire_version(c.cle),
         case when c.promo_id is not null then jsonb_build_object('promo_id', c.promo_id)
              else jsonb_build_object('lieu_id', c.lieu_id, 'annee', c.annee) end
    from candidats c
   where auth.uid() is not null
     and _questionnaire_ayant_droit(c.cle, c.promo_id, c.lieu_id)
     and _questionnaire_ouvert(c.cle, c.promo_id, c.lieu_id, c.annee)
     and not exists (
       select 1 from questionnaire_participations p
        where p.cle = c.cle and p.promo_id is not distinct from c.promo_id
          and p.lieu_id is not distinct from c.lieu_id and p.annee is not distinct from c.annee
          and (p.user_id = auth.uid()
               or (c.promo_id is not null and p.stagiaire_id = (select moi.stagiaire_id from moi))))
   order by 1, 3;
$function$;

-- repondre_questionnaire : comme avant, sauf la participation rattachée à la fiche (stagiaires : une deuxième réponse
-- est refusée même depuis un compte recréé) et le brassage, extrait dans _questionnaire_rebrasser.
create or replace function public.repondre_questionnaire(p_cle text, p_portee jsonb, p_version integer, p_reponses jsonb,
  p_commentaire text default null)
returns void
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(auth.jwt() ->> 'email');
  v_version integer := _questionnaire_version(p_cle);
  v_portee record;
  v_commentaire text := nullif(btrim(coalesce(p_commentaire, ''), E' \t\r\n'), '');
  v_question text;
  v_valeur jsonb;
  q questionnaire_questions%rowtype;
  v_fiche integer;
  n integer;
begin
  if v_uid is null or v_email is null then
    raise exception 'questionnaire: Reconnecte-toi pour répondre.';
  end if;
  if v_version is null then
    raise exception 'questionnaire: Questionnaire inconnu.';
  end if;
  if p_version is distinct from v_version then
    raise exception 'questionnaire: Le questionnaire a changé : recharge la page.';
  end if;
  select * into v_portee from _questionnaire_portee(p_cle, p_portee);
  if not _questionnaire_ayant_droit(p_cle, v_portee.promo_id, v_portee.lieu_id) then
    raise exception 'questionnaire: Ce questionnaire ne te concerne pas.';
  end if;
  -- Une portée à la fois (voir l'en-tête de la migration Q3) : un envoi simultané dans la même portée attend la fin de
  -- celui-ci ; les instructions suivantes, chacune avec un instantané neuf, voient alors ses lignes validées.
  perform pg_advisory_xact_lock(hashtext('questionnaire:' || p_cle || ':'
    || coalesce(v_portee.promo_id::text, v_portee.lieu_id::text || '/' || v_portee.annee::text)));
  if not _questionnaire_ouvert(p_cle, v_portee.promo_id, v_portee.lieu_id, v_portee.annee) then
    raise exception 'questionnaire: Ce questionnaire est fermé.';
  end if;
  -- Stagiaires : la fiche de la personne (celle qui lui donne droit de répondre), à qui la participation est rattachée.
  if _questionnaire_public(p_cle) = 'stagiaire' then
    select s.id into v_fiche from user_profiles up join stagiaires s on s.id = up.stagiaire_id
     where lower(up.email) = v_email and s.promo_id = v_portee.promo_id and s.anonymise_le is null
     limit 1;
  end if;
  if exists (select 1 from questionnaire_participations p
              where p.cle = p_cle and p.promo_id is not distinct from v_portee.promo_id
                and p.lieu_id is not distinct from v_portee.lieu_id and p.annee is not distinct from v_portee.annee
                and (p.user_id = v_uid or (v_fiche is not null and p.stagiaire_id = v_fiche))) then
    raise exception 'questionnaire: Tu as déjà répondu à ce questionnaire.';
  end if;

  -- Forme : un objet { question: valeur } ; questions connues de cette version ; échelle 1 à 4 ou null (« sans
  -- avis ») ; choix parmi les options ; toutes les questions non facultatives présentes.
  if p_reponses is null or jsonb_typeof(p_reponses) <> 'object' then
    raise exception 'questionnaire: Réponses illisibles.';
  end if;
  for v_question, v_valeur in select e.key, e.value from jsonb_each(p_reponses) e loop
    select * into q from questionnaire_questions
     where cle = p_cle and version = v_version and question_id = v_question;
    if not found then
      raise exception 'questionnaire: Question inconnue.';
    end if;
    if q.type = 'echelle' and not (jsonb_typeof(v_valeur) = 'null'
        or (jsonb_typeof(v_valeur) = 'number' and v_valeur::text in ('1', '2', '3', '4'))) then
      raise exception 'questionnaire: Réponse hors de l''échelle.';
    end if;
    if q.type = 'choix' and not (jsonb_typeof(v_valeur) = 'string' and (v_valeur #>> '{}') = any (q.options)) then
      raise exception 'questionnaire: Choix inconnu.';
    end if;
  end loop;
  if exists (select 1 from questionnaire_questions
              where cle = p_cle and version = v_version and not facultative and not (p_reponses ? question_id)) then
    raise exception 'questionnaire: Il manque des réponses.';
  end if;
  if char_length(coalesce(v_commentaire, '')) > 2000 then
    raise exception 'questionnaire: Ton commentaire dépasse 2 000 caractères.';
  end if;

  -- Deux envois simultanés : les contraintes d'unicité (par compte, par fiche) tranchent, le second est refusé et
  -- n'écrit rien.
  insert into questionnaire_participations (cle, promo_id, lieu_id, annee, user_id, stagiaire_id)
  values (p_cle, v_portee.promo_id, v_portee.lieu_id, v_portee.annee, v_uid, v_fiche)
  on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'questionnaire: Tu as déjà répondu à ce questionnaire.';
  end if;
  insert into questionnaire_reponses (cle, version, promo_id, lieu_id, annee, reponses, commentaire)
  values (p_cle, v_version, v_portee.promo_id, v_portee.lieu_id, v_portee.annee, p_reponses, v_commentaire);

  -- Brassage (voir l'en-tête de la migration Q3).
  perform _questionnaire_rebrasser(p_cle, v_portee.promo_id, v_portee.lieu_id, v_portee.annee);
end;
$function$;

-- resultats_questionnaire : la ligne figée si elle existe ({ ..., fige: true, fige_le }), sinon le calcul vivant, sous
-- la même forme qu'avant.
create or replace function public.resultats_questionnaire(p_cle text, p_portee jsonb)
returns jsonb
language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $function$
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
$function$;

-- ouvrir_questionnaire : comme avant, mais un questionnaire clos pour de bon ne se rouvre plus (le fermer ou le rendre
-- à ses dates reste permis, sans effet).
create or replace function public.ouvrir_questionnaire(p_cle text, p_portee jsonb, p_ouvert boolean)
returns void
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
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
$function$;

-- 10.5 Questionnaire des formateurs : clôture, commentaires, figeage (fondateur, lieu accessible) -------------------
-- Un lieu est accessible par une de ses promos (peut_acceder_promo), pour que l'élargissement du lot 5 ne laisse pas
-- un centre effacer un autre. Journal de type « questionnaires », cible « lieu <id>, année <aaaa> », sans nom.
create function public.clore_annee_formateurs(p_lieu integer, p_annee integer)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_du date;
  r integer;
  n integer;
  v jsonb;
begin
  if not peut_gerer_qualite() then
    raise exception 'conservation: Réservé à la gestion de la qualité.';
  end if;
  if p_lieu is null or not exists (select 1 from promos pr where pr.lieu_id = p_lieu and peut_acceder_promo(pr.id)) then
    raise exception 'conservation: Ce lieu n''est pas dans votre périmètre.';
  end if;
  if p_annee is null or p_annee not between 2000 and 2100 then
    raise exception 'conservation: Année illisible.';
  end if;
  v_du := make_date(p_annee + 1, 1, 1);
  if _questionnaire_jour() < v_du then
    raise exception 'conservation: Possible à partir du %.', to_char(v_du, 'DD/MM/YYYY');
  end if;
  select count(*) into r from questionnaire_reponses
   where cle = 'fin_formateur' and lieu_id = p_lieu and annee = p_annee;
  n := _questionnaire_clore(p_lieu, p_annee);
  -- Rien sous le seuil (lot Q3) : le nombre seulement si la portée a au moins le seuil de répondants.
  v := jsonb_build_object('efface', n > 0)
       || case when greatest(n, r) >= _questionnaire_seuil('fin_formateur')
               then jsonb_build_object('participations', n) else '{}'::jsonb end;
  if n > 0 then
    insert into effacements_journal (type, cible, fait_par_email, details)
    values ('questionnaires', 'lieu ' || p_lieu || ', année ' || p_annee, lower(auth.jwt() ->> 'email'),
            jsonb_build_object('questionnaire', 'fin_formateur') || v);
  end if;
  return v;
end;
$function$;

create function public.effacer_commentaires_formateurs(p_lieu integer, p_annee integer)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_du date;
  r integer;
  m integer;
  n integer;
  v jsonb;
begin
  if not peut_gerer_qualite() then
    raise exception 'conservation: Réservé à la gestion de la qualité.';
  end if;
  if p_lieu is null or not exists (select 1 from promos pr where pr.lieu_id = p_lieu and peut_acceder_promo(pr.id)) then
    raise exception 'conservation: Ce lieu n''est pas dans votre périmètre.';
  end if;
  if p_annee is null or p_annee not between 2000 and 2100 then
    raise exception 'conservation: Année illisible.';
  end if;
  v_du := make_date(p_annee + 1, 12, 31);
  if _questionnaire_jour() < v_du then
    raise exception 'conservation: Possible à partir du %.', to_char(v_du, 'DD/MM/YYYY');
  end if;
  select count(*) into r from questionnaire_reponses
   where cle = 'fin_formateur' and lieu_id = p_lieu and annee = p_annee;
  m := _questionnaire_clore(p_lieu, p_annee);
  n := _questionnaire_effacer_commentaires('fin_formateur', null, p_lieu, p_annee);
  -- Rien sous le seuil (lot Q3) : les nombres seulement si la portée a au moins le seuil de répondants.
  v := jsonb_build_object('efface', m + n > 0)
       || case when greatest(m, r) >= _questionnaire_seuil('fin_formateur')
               then jsonb_build_object('participations', m, 'commentaires', n) else '{}'::jsonb end;
  if m + n > 0 then
    insert into effacements_journal (type, cible, fait_par_email, details)
    values ('questionnaires', 'lieu ' || p_lieu || ', année ' || p_annee, lower(auth.jwt() ->> 'email'),
            jsonb_build_object('questionnaire', 'fin_formateur') || v);
  end if;
  return v;
end;
$function$;

create function public.figer_questionnaire_formateurs(p_lieu integer, p_annee integer)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_du date;
  r integer;
  m integer;
  v jsonb;
begin
  if not peut_gerer_qualite() then
    raise exception 'conservation: Réservé à la gestion de la qualité.';
  end if;
  if p_lieu is null or not exists (select 1 from promos pr where pr.lieu_id = p_lieu and peut_acceder_promo(pr.id)) then
    raise exception 'conservation: Ce lieu n''est pas dans votre périmètre.';
  end if;
  if p_annee is null or p_annee not between 2000 and 2100 then
    raise exception 'conservation: Année illisible.';
  end if;
  v_du := make_date(p_annee + 4, 1, 1);
  if _questionnaire_jour() < v_du then
    raise exception 'conservation: Possible à partir du %.', to_char(v_du, 'DD/MM/YYYY');
  end if;
  select count(*) into r from questionnaire_reponses
   where cle = 'fin_formateur' and lieu_id = p_lieu and annee = p_annee;
  m := _questionnaire_clore(p_lieu, p_annee);
  -- Le retour du figeage ne donne le nombre de réponses qu'à partir du seuil ; les participations effacées au passage,
  -- de même.
  v := _questionnaire_figer('fin_formateur', null, p_lieu, p_annee);
  if m > 0 or v ? 'fige' then
    insert into effacements_journal (type, cible, fait_par_email, details)
    values ('questionnaires', 'lieu ' || p_lieu || ', année ' || p_annee, lower(auth.jwt() ->> 'email'),
            jsonb_build_object('questionnaire', 'fin_formateur') || v
            || case when greatest(m, r) >= _questionnaire_seuil('fin_formateur')
                    then jsonb_build_object('participations', m) else '{}'::jsonb end);
  end if;
  return v;
end;
$function$;

revoke all on function public.clore_annee_formateurs(integer, integer), public.effacer_commentaires_formateurs(integer, integer),
  public.figer_questionnaire_formateurs(integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.clore_annee_formateurs(integer, integer), public.effacer_commentaires_formateurs(integer, integer),
  public.figer_questionnaire_formateurs(integer, integer) to authenticated, service_role;

-- 11. Registre qualité (lot Q4) : effacement des textes tracé au journal ---------------------------------------------------
-- Même signature, mêmes droits, même échéance unique (une entrée close depuis plus de 3 ans ; une entrée jamais close ne
-- s'efface jamais) que la version du lot Q4 ; en plus, une ligne de type « registre » au journal (cible « registre », nombre
-- d'entrées vidées) quand au moins une entrée est vidée. Un second appel ne vide rien et n'écrit rien. Le bouton reste celui
-- du registre ; la page Qualiopi montre l'échéance par etat_conservation() et y renvoie.
create or replace function public.effacer_registre_qualite()
returns integer
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
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
$function$;
revoke all on function public.effacer_registre_qualite() from public, anon;
grant execute on function public.effacer_registre_qualite() to authenticated;
